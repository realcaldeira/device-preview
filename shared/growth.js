/* Shared growth/retention URLs — keep in sync with docs/ and service-worker. */
const DP_STORE_ID = 'ebnbfkejdddkbpkljbbcnchnlekombef';
const DP_STORE_URL =
  'https://chromewebstore.google.com/detail/simulador-mobile/' + DP_STORE_ID;
const DP_REVIEW_URL = DP_STORE_URL + '/reviews';
const DP_SITE_BASE = 'https://realcaldeira.github.io/device-preview';
const DP_UNINSTALL_URL = DP_SITE_BASE + '/uninstall.html';
const DP_FAQ_URL = DP_SITE_BASE + '/faq.html';
const DP_LANDING_URL = DP_SITE_BASE + '/';

const DP_HISTORY_KEY = 'recentHistory';
const DP_HISTORY_MAX = 8;
const DP_ONBOARDING_KEY = 'onboardingDone';
const DP_REVIEW_KEY = 'reviewPrompt';
const DP_SESSIONS_KEY = 'weekSessions';

const DP_PRESETS = [
  {
    id: 'qa-ios',
    nameKey: 'preset_qa_ios_name',
    hintKey: 'preset_qa_ios_hint',
    devices: ['iphone-16', 'iphone-se-2016', 'ipad-air']
  },
  {
    id: 'android-mid',
    nameKey: 'preset_android_mid_name',
    hintKey: 'preset_android_mid_hint',
    devices: ['galaxy-a12', 'pixel-8', 'galaxy-s24']
  },
  {
    id: 'tv-living',
    nameKey: 'preset_tv_living_name',
    hintKey: 'preset_tv_living_hint',
    devices: ['tv-fullhd', 'tv-4k']
  }
];

const DP_DEMO_URL = 'https://www.wikipedia.org/';
