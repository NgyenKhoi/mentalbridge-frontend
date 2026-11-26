const { withAndroidManifest } = require('expo/config-plugins')

module.exports = (config) =>
  withAndroidManifest(config, (result) => {
    const application = result.modResults.manifest.application[0].$
    // Local HTTP is confined to the separately installed development app.
    application['android:usesCleartextTraffic'] = 'true'
    delete application['android:networkSecurityConfig']
    return result
  })
