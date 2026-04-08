import {
  auth,
  db,
  RecaptchaVerifier,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  multiFactor,
  getDoc,
  updateDoc,
  doc,
  serverTimestamp
} from "./firebase.js";

let recaptchaVerifier = null;
let enrollmentVerificationId = "";
let signInVerificationId = "";
let activeResolver = null;

function ensureRecaptcha(containerId = "recaptcha-container") {
  if (recaptchaVerifier) return recaptchaVerifier;

  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: "invisible"
  });

  return recaptchaVerifier;
}

export function maskPhoneNumber(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `••• ••• ${digits.slice(-4)}`;
}

export async function getCurrentMfaStatus(user) {
  const factors = multiFactor(user).enrolledFactors || [];
  const phoneFactor = factors.find(f => f.factorId === PhoneMultiFactorGenerator.FACTOR_ID);

  const snap = await getDoc(doc(db, "users", user.uid));
  const data = snap.exists() ? snap.data() : {};

  return {
    enabled: !!phoneFactor || !!data.mfaEnabled,
    enrolledFactors: factors,
    phoneLast4: data.mfaPhoneLast4 || "",
    displayName: data.mfaDisplayName || "",
    phoneFactor
  };
}

export async function startMfaEnrollment(user, phoneNumber, displayName = "Primary phone") {
  if (!user) throw new Error("No signed-in user.");
  if (!phoneNumber) throw new Error("Phone number is required.");

  const verifier = ensureRecaptcha();
  const session = await multiFactor(user).getSession();

  const phoneInfoOptions = {
    phoneNumber,
    session
  };

  const provider = new PhoneAuthProvider(auth);
  enrollmentVerificationId = await provider.verifyPhoneNumber(phoneInfoOptions, verifier);

  return {
    ok: true,
    maskedPhone: maskPhoneNumber(phoneNumber),
    verificationId: enrollmentVerificationId,
    displayName
  };
}

export async function completeMfaEnrollment(user, code, phoneNumber, displayName = "Primary phone") {
  if (!user) throw new Error("No signed-in user.");
  if (!enrollmentVerificationId) throw new Error("Start enrollment first.");
  if (!code) throw new Error("Verification code is required.");

  const cred = PhoneAuthProvider.credential(enrollmentVerificationId, code);
  const assertion = PhoneMultiFactorGenerator.assertion(cred);

  await multiFactor(user).enroll(assertion, displayName);

  const digits = String(phoneNumber || "").replace(/\D/g, "");
  const phoneLast4 = digits.slice(-4);

  await updateDoc(doc(db, "users", user.uid), {
    mfaEnabled: true,
    mfaPhoneLast4: phoneLast4,
    mfaDisplayName: displayName,
    mfaEnrolledAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  enrollmentVerificationId = "";

  return {
    ok: true,
    phoneLast4,
    maskedPhone: maskPhoneNumber(phoneNumber)
  };
}

export async function disableMfa(user) {
  if (!user) throw new Error("No signed-in user.");

  const factors = multiFactor(user).enrolledFactors || [];
  const phoneFactors = factors.filter(f => f.factorId === PhoneMultiFactorGenerator.FACTOR_ID);

  for (const factor of phoneFactors) {
    await multiFactor(user).unenroll(factor);
  }

  await updateDoc(doc(db, "users", user.uid), {
    mfaEnabled: false,
    mfaPhoneLast4: "",
    mfaDisplayName: "",
    updatedAt: serverTimestamp()
  });

  return { ok: true };
}

export async function beginMfaSignIn(error, containerId = "recaptcha-container") {
  const verifier = ensureRecaptcha(containerId);
  activeResolver = error.customData?.resolver || null;

  if (!activeResolver) {
    throw new Error("MFA resolver missing.");
  }

  const hint = activeResolver.hints.find(
    h => h.factorId === PhoneMultiFactorGenerator.FACTOR_ID
  ) || activeResolver.hints[0];

  if (!hint) {
    throw new Error("No supported MFA factor found.");
  }

  const phoneInfoOptions = {
    multiFactorHint: hint,
    session: activeResolver.session
  };

  const provider = new PhoneAuthProvider(auth);
  signInVerificationId = await provider.verifyPhoneNumber(phoneInfoOptions, verifier);

  return {
    ok: true,
    hint,
    maskedPhone: hint.phoneNumber || "your phone"
  };
}

export async function completeMfaSignIn(code) {
  if (!activeResolver) throw new Error("No active MFA sign-in.");
  if (!signInVerificationId) throw new Error("No MFA verification ID.");
  if (!code) throw new Error("Verification code is required.");

  const cred = PhoneAuthProvider.credential(signInVerificationId, code);
  const assertion = PhoneMultiFactorGenerator.assertion(cred);

  const userCredential = await activeResolver.resolveSignIn(assertion);

  activeResolver = null;
  signInVerificationId = "";

  return userCredential;
}
