import { readFileSync } from 'node:fs';
import { RequestMethod, type INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { ModulesContainer } from '@nestjs/core';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { IS_PUBLIC_KEY } from '../src/auth/decorators/public.decorator.js';
import { ROLES_KEY } from '../src/auth/decorators/roles.decorator.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { loginAll, type Tokens } from './helpers/catalog.js';
import { createTestApp } from './helpers/create-app.js';
import { migrateTestDatabase, resetAndSeed } from './helpers/test-db.js';

interface Route {
  method: string;
  path: string;
  roles: string[]; // [] = every signed-in role
  isPublic: boolean;
}

const CATALOG = 'docs/06-api/endpoints-catalog.md';
const ROLE_USERS: Record<string, string> = {
  ADMIN: 'admin',
  QUAN_LY_KHO: 'quanly',
  NHAN_VIEN_KHO: 'kho',
  KE_TOAN: 'ketoan',
};
const DUMMY_ID = '00000000-0000-4000-8000-000000000001';

const join = (...parts: (string | undefined)[]) =>
  '/' +
  parts
    .flatMap((p) => (p ?? '').split('/'))
    .filter(Boolean)
    .join('/');

// Every route registered by a controller, read from the decorators.
function collectRoutes(app: INestApplication<App>): Route[] {
  const routes: Route[] = [];
  const container = app.get(ModulesContainer);
  const seen = new Set<unknown>();
  for (const module of container.values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype as (new () => object) | null;
      if (!controller || seen.has(controller)) continue;
      seen.add(controller);
      const base = Reflect.getMetadata(PATH_METADATA, controller) as string;
      for (const name of Object.getOwnPropertyNames(controller.prototype)) {
        const handler = (controller.prototype as Record<string, unknown>)[name];
        if (typeof handler !== 'function') continue;
        const method = Reflect.getMetadata(METHOD_METADATA, handler) as
          number | undefined;
        if (method === undefined) continue;
        const sub = Reflect.getMetadata(PATH_METADATA, handler) as string;
        const read = <T>(key: string) =>
          (Reflect.getMetadata(key, handler) ??
            Reflect.getMetadata(key, controller)) as T | undefined;
        routes.push({
          method: RequestMethod[method]!,
          path: join('api/v1', base, sub),
          roles: read<string[]>(ROLES_KEY) ?? [],
          isPublic: read<boolean>(IS_PUBLIC_KEY) === true,
        });
      }
    }
  }
  return routes;
}

// One row per endpoint in the catalog tables.
function parseCatalog(): Route[] {
  const rows: Route[] = [];
  for (const line of readFileSync(CATALOG, 'utf8').split('\n')) {
    const m =
      /^\| (GET|POST|PATCH|PUT|DELETE) \| `([^`]+)` \| (Public|JWT) \| ([^|]+) \|/.exec(
        line,
      );
    if (!m) continue;
    const [, method, path, auth, rolesCell] = m as unknown as [
      string,
      string,
      string,
      string,
      string,
    ];
    const cell = rolesCell.trim();
    // "theo quyền ..." = checked inside the service per target type, so no @Roles.
    const open =
      cell === 'mọi role' || cell === '—' || cell.startsWith('theo quyền');
    rows.push({
      method,
      path,
      isPublic: auth === 'Public',
      roles: open
        ? []
        : cell.split(',').map((r) => r.trim().replace(/\*$/, '')),
    });
  }
  return rows;
}

const key = (r: Route) => `${r.method} ${r.path}`;
const rolesText = (r: Route) =>
  r.isPublic
    ? 'Public'
    : r.roles.length
      ? [...r.roles].sort().join(',')
      : 'mọi role';

describe('Danh mục endpoint và phân quyền (e2e)', () => {
  let app: INestApplication<App>;
  let tokens: Tokens;
  let routes: Route[];

  beforeAll(async () => {
    migrateTestDatabase();
    app = await createTestApp();
    await resetAndSeed(app.get(PrismaService));
    tokens = await loginAll(app, Object.values(ROLE_USERS));
    routes = collectRoutes(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('đối chiếu code và docs/06-api/endpoints-catalog.md', () => {
    it('mọi endpoint trong code đều có dòng trong catalog, và ngược lại', () => {
      const inCode = new Set(routes.map(key));
      const inDocs = parseCatalog().map(key);
      expect(inDocs.filter((k) => !inCode.has(k)).sort()).toEqual([]);
      const docSet = new Set(inDocs);
      expect([...inCode].filter((k) => !docSet.has(k)).sort()).toEqual([]);
    });

    it('catalog không có dòng trùng', () => {
      const keys = parseCatalog().map(key);
      expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
    });

    it('role ghi trong catalog khớp @Roles trong code', () => {
      const docs = new Map(parseCatalog().map((r) => [key(r), r]));
      const mismatched = routes
        .map((code) => {
          const doc = docs.get(key(code));
          return doc && rolesText(doc) !== rolesText(code)
            ? `${key(code)}: catalog=${rolesText(doc)} code=${rolesText(code)}`
            : null;
        })
        .filter(Boolean);
      expect(mismatched).toEqual([]);
    });

    it('tiêu đề catalog ghi đúng tổng số endpoint', () => {
      const text = readFileSync(CATALOG, 'utf8');
      const total = /Tổng số endpoint: \*\*(\d+)\*\*/.exec(text);
      expect(Number(total?.[1])).toBe(routes.length);
    });
  });

  describe('ma trận role × endpoint chạy thật', () => {
    const call = (route: Route, token?: string) => {
      const path = route.path.replace(/:[A-Za-z]+/g, DUMMY_ID);
      const agent = request(app.getHttpServer());
      const req = {
        GET: () => agent.get(path),
        POST: () => agent.post(path),
        PATCH: () => agent.patch(path),
        PUT: () => agent.put(path),
        DELETE: () => agent.delete(path),
      }[route.method]!();
      return token ? req.set('Authorization', `Bearer ${token}`) : req;
    };

    it('không có token → 401 ở mọi endpoint không public', async () => {
      const failures: string[] = [];
      for (const route of routes.filter((r) => !r.isPublic)) {
        const res = await call(route);
        if (res.status !== 401) failures.push(`${key(route)} → ${res.status}`);
      }
      expect(failures).toEqual([]);
    });

    it('role không được phép → 403 AUTH_FORBIDDEN; role được phép không bị chặn bởi phân quyền', async () => {
      const failures: string[] = [];
      for (const route of routes.filter((r) => !r.isPublic)) {
        for (const [role, user] of Object.entries(ROLE_USERS)) {
          const res = await call(route, tokens[user]);
          const code = (res.body as { code?: string } | undefined)?.code;
          const denied = res.status === 403 && code === 'AUTH_FORBIDDEN';
          const allowed =
            route.roles.length === 0 || route.roles.includes(role);
          if (allowed && (denied || res.status === 401)) {
            failures.push(`${key(route)} bị chặn với ${role} (${res.status})`);
          }
          if (!allowed && !denied) {
            failures.push(`${key(route)} không chặn ${role} (${res.status})`);
          }
        }
      }
      expect(failures).toEqual([]);
    });
  });
});
