import { loadAppConfig, parseBoolean } from './app.config.js';

const base = (extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv => ({
  ...extra,
});

describe('loadAppConfig', () => {
  it('giá trị mặc định cho môi trường dev', () => {
    expect(loadAppConfig(base())).toEqual({
      nodeEnv: 'development',
      port: 3000,
      corsOrigins: [],
      trustProxy: false,
      logLevel: 'debug',
      swaggerEnabled: true,
      swaggerUser: null,
      swaggerPassword: null,
    });
  });

  it('production: log info, Swagger tắt mặc định', () => {
    const config = loadAppConfig(base({ NODE_ENV: 'production' }));
    expect(config.logLevel).toBe('info');
    expect(config.swaggerEnabled).toBe(false);
  });

  it('bật Swagger ở production mà thiếu basic-auth → lỗi khi khởi động', () => {
    expect(() =>
      loadAppConfig(base({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })),
    ).toThrow(/SWAGGER_USER/);
    expect(
      loadAppConfig(
        base({
          NODE_ENV: 'production',
          SWAGGER_ENABLED: 'true',
          SWAGGER_USER: 'u',
          SWAGGER_PASSWORD: 'p',
        }),
      ).swaggerEnabled,
    ).toBe(true);
  });

  it('CORS_ORIGINS tách theo dấu phẩy, bỏ khoảng trắng và phần rỗng', () => {
    expect(
      loadAppConfig(base({ CORS_ORIGINS: ' http://a.vn , ,http://b.vn' }))
        .corsOrigins,
    ).toEqual(['http://a.vn', 'http://b.vn']);
  });

  it('TRUST_PROXY là số tầng proxy', () => {
    expect(loadAppConfig(base({ TRUST_PROXY: '1' })).trustProxy).toBe(1);
    expect(() => loadAppConfig(base({ TRUST_PROXY: 'x' }))).toThrow(
      /TRUST_PROXY/,
    );
  });

  it.each([
    [{ NODE_ENV: 'staging' }, /NODE_ENV/],
    [{ PORT: '0' }, /PORT/],
    [{ PORT: 'abc' }, /PORT/],
    [{ LOG_LEVEL: 'loud' }, /LOG_LEVEL/],
    [{ SWAGGER_ENABLED: 'yes' }, /boolean/],
  ])('từ chối cấu hình sai %j', (env, pattern) => {
    expect(() => loadAppConfig(base(env))).toThrow(pattern);
  });
});

describe('parseBoolean', () => {
  it('dùng mặc định khi không đặt', () => {
    expect(parseBoolean(undefined, true)).toBe(true);
    expect(parseBoolean('', false)).toBe(false);
  });

  it('chỉ chấp nhận true/false', () => {
    expect(parseBoolean('true', false)).toBe(true);
    expect(parseBoolean('false', true)).toBe(false);
    expect(() => parseBoolean('1', true)).toThrow();
  });
});
