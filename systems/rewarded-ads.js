const TEST_REWARDED_AD_UNIT_ID = "ca-app-pub-3940256099942544/5224354917";
let admobInitialized = false;
let rewardedAdInProgress = false;

function isRewardedAdAvailable() {
  return window.Capacitor?.isNativePlatform?.() === true &&
    window.Capacitor?.getPlatform?.() === "android";
}

async function showRewardedAd() {
  if (!isRewardedAdAvailable()) {
    throw new Error("Rewarded ads require the installed Android app.");
  }
  if (rewardedAdInProgress) {
    throw new Error("A rewarded ad is already in progress.");
  }
  const config = window.CryptsAdMobConfig;
  if (!config || !["test", "production"].includes(config.mode) ||
    typeof config.androidRewardedAdUnitId !== "string" || !config.androidRewardedAdUnitId.trim()) {
    throw new Error("Configure a valid Android rewarded-ad unit ID before requesting an ad.");
  }
  if (config.mode === "production" && config.androidRewardedAdUnitId === TEST_REWARDED_AD_UNIT_ID) {
    throw new Error("Replace the test rewarded-ad unit ID before enabling production ads.");
  }

  rewardedAdInProgress = true;
  try {
    const { AdMob } = await import("@capacitor-community/admob");
    if (!admobInitialized) {
      await AdMob.initialize({ initializeForTesting: config.mode === "test" });
      admobInitialized = true;
    }
    await AdMob.prepareRewardVideoAd({
      adId: config.androidRewardedAdUnitId,
      isTesting: config.mode === "test",
      immersiveMode: true
    });
    const reward = await AdMob.showRewardVideoAd();
    return Number.isFinite(reward?.amount) && reward.amount > 0;
  } finally {
    rewardedAdInProgress = false;
  }
}

window.CryptsRewardedAds = Object.freeze({
  isAvailable: isRewardedAdAvailable,
  showRewardedAd
});
