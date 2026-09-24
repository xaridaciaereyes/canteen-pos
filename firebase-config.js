/*
  FIREBASE SETTINGS
  -----------------
  While FIREBASE_CONFIG is null, the app runs in DEMO MODE:
  everything is saved only on the device you are using.
  Demo sign-in: username "owner", password "akotosishypanget".

  To save in the cloud, follow README.md step 2, then replace
  `null` below with the config Firebase gives you. It looks like this:

  window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAfu6qNlRCH2fouvDzEo-WsONeEMiyfnfE",
  authDomain: "canteen-pos-700e3.firebaseapp.com",
  projectId: "canteen-pos-700e3",
  storageBucket: "canteen-pos-700e3.firebasestorage.app",
  messagingSenderId: "377687169191",
  appId: "1:377687169191:web:f4eced62e5340f2f0b2382"
};
*/
window.FIREBASE_CONFIG = null;

// The owner's login email (the one you created in Firebase > Authentication).
// This account can open everything and create accounts for the staff.
window.OWNER_EMAIL = "xaridaciaereyes@gmail.com";
