module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'development') return config

  return {
    ...config,
    name: 'MentalBridge Dev',
    scheme: 'mentalbridge-dev',
    android: { ...config.android, package: 'com.mentalbridge.mobile.dev' },
    ios: { ...config.ios, bundleIdentifier: 'com.mentalbridge.mobile.dev' },
    plugins: [...(config.plugins ?? []), './plugins/with-development-network'],
  }
}
