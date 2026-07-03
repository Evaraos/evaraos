import {
  auth,
  db,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  getSavedUserProfile
} from "./firebase.js";

import { getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const REGISTRY = "_group_registry";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const BUILTIN_GROUPS = new Set(["operations", "field-crews", "hr-support", "leadership"]);
const ADMIN_ROLES = new Set(["owner", "super_admin", "admin", "manager", "operations_manager", "hr_manager"]);
const storage = getStorage(getApp());

let activeConversationId = "";
let activeRegistry = null;
let uploading = false;

const imageButton = document.getElementById("conversationPhotoButton");
const image = document.getElementById("conversationPhotoImage");
const input = document.getElementById("conversationPhotoInput");
const changeButton = document.getElementById("changeConversationPhoto");
const status = document.getElementById("conversationPhotoStatus");
const viewer = document.getElementById("conversationPhotoViewer");

function normalize(value = "") {
  return String(value || "").trim().toLowerCase();
}

function currentRole() {
  return normalize(getSavedUserProfile()?.role || "customer");
}

function currentUserId() {
  return auth.currentUser?.uid || "";
}

function canEditRegistry(registry) {
  const uid = currentUserId();
  if (!uid) return false;
  if (ADMIN_ROLES.has(currentRole())) return true;
  return Array.isArray(registry?.adminUids) && registry.adminUids.includes(uid);
}

function setStatus(message = "", tone = "") {
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
  status.hidden = !message;
}

function setControlsEnabled(enabled) {
  if (imageButton) {
    imageButton.disabled = !enabled || uploading;
    imageButton.setAttribute("aria-disabled", String(!enabled || uploading));
  }
  if (changeButton) {
    changeButton.hidden = !enabled;
    changeButton.disabled = uploading;
  }
  if (input) input.disabled = !enabled || uploading;
}

async function findRegistry(conversationId) {
  if (!conversationId) return null;
  const snapshot = await getDocs(query(
    collection(db, "channels", REGISTRY, "messages"),
    where("groupId", "==", conversationId)
  ));
  if (snapshot.empty) return null;
  const document = snapshot.docs[0];
  return { document, data: { registryDocId: document.id, ...document.data() } };
}

async function resolveActiveRegistry() {
  if (!activeConversationId) return null;
  const existing = await findRegistry(activeConversationId);
  if (existing) return existing;

  if (!BUILTIN_GROUPS.has(activeConversationId) || !ADMIN_ROLES.has(currentRole())) return null;

  const name = document.getElementById("chatTitle")?.textContent?.trim() || "Team Channel";
  const reference = await addDoc(collection(db, "channels", REGISTRY, "messages"), {
    kind: "role_meta",
    groupId: activeConversationId,
    name,
    description: "Team channel",
    adminUids: [currentUserId()],
    allowedRoles: [],
    createdBy: currentUserId(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return {
    document: reference,
    data: {
      registryDocId: reference.id,
      kind: "role_meta",
      groupId: activeConversationId,
      name,
      adminUids: [currentUserId()]
    }
  };
}

async function prepareViewer() {
  activeConversationId = document.documentElement.dataset.activeConversation || activeConversationId;
  activeRegistry = await resolveActiveRegistry().catch((error) => {
    console.warn("Unable to resolve group image permissions", error);
    return null;
  });

  const editable = Boolean(activeRegistry && canEditRegistry(activeRegistry.data));
  setControlsEnabled(editable);
  setStatus(editable ? "Tap the image or choose Change Group Image." : "Only group administrators can change this image.");
}

function safeExtension(file) {
  const extension = String(file?.name || "").split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension || "jpg";
}

function updateVisibleImages(url) {
  if (image) image.src = url;

  const chatAvatar = document.getElementById("chatAvatar");
  if (chatAvatar) {
    chatAvatar.replaceChildren();
    const avatarImage = document.createElement("img");
    avatarImage.src = url;
    avatarImage.alt = document.getElementById("chatTitle")?.textContent || "Conversation";
    chatAvatar.appendChild(avatarImage);
  }

  document.querySelectorAll(`[data-conversation="${CSS.escape(activeConversationId)}"] .conversation-avatar`).forEach((avatar) => {
    avatar.replaceChildren();
    const avatarImage = document.createElement("img");
    avatarImage.src = url;
    avatarImage.alt = "Conversation";
    avatar.appendChild(avatarImage);
  });
}

async function uploadGroupImage(file) {
  if (uploading || !file || !activeConversationId) return;
  if (!file.type.startsWith("image/")) {
    setStatus("Choose an image file.", "error");
    return;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    setStatus("The image must be smaller than 10 MB.", "error");
    return;
  }

  activeRegistry = activeRegistry || await resolveActiveRegistry();
  if (!activeRegistry || !canEditRegistry(activeRegistry.data)) {
    setStatus("You do not have permission to change this group image.", "error");
    return;
  }

  uploading = true;
  setControlsEnabled(true);
  setStatus("Uploading group image…");

  try {
    const path = `messages/${activeConversationId}/group-${Date.now()}.${safeExtension(file)}`;
    const reference = storageRef(storage, path);
    await uploadBytes(reference, file, {
      contentType: file.type,
      customMetadata: {
        ownerUid: currentUserId(),
        conversationId: activeConversationId,
        purpose: "group-photo"
      }
    });
    const imageUrl = await getDownloadURL(reference);

    await updateDoc(activeRegistry.document, {
      imageUrl,
      imageStoragePath: path,
      imageUpdatedAt: serverTimestamp(),
      imageUpdatedBy: currentUserId(),
      updatedAt: serverTimestamp()
    });

    activeRegistry.data.imageUrl = imageUrl;
    updateVisibleImages(imageUrl);
    setStatus("Group image updated.", "success");
    window.dispatchEvent(new CustomEvent("evara:notify", {
      detail: {
        title: "Group image updated",
        message: "The new image is now visible to everyone in this chat.",
        tone: "success",
        timeout: 3600
      }
    }));
  } catch (error) {
    console.error("Group image upload failed", error);
    setStatus(error?.message || "The group image could not be updated.", "error");
  } finally {
    uploading = false;
    setControlsEnabled(Boolean(activeRegistry && canEditRegistry(activeRegistry.data)));
    if (input) input.value = "";
  }
}

function openPicker() {
  if (!uploading && !input?.disabled) input?.click();
}

document.addEventListener("click", (event) => {
  const conversation = event.target.closest?.("[data-conversation]");
  if (conversation?.dataset?.conversation) {
    activeConversationId = conversation.dataset.conversation;
    document.documentElement.dataset.activeConversation = activeConversationId;
    activeRegistry = null;
  }

  if (event.target.closest?.("#viewConversationPhoto")) {
    setTimeout(prepareViewer, 0);
  }

  if (event.target.closest?.("#conversationPhotoButton, #changeConversationPhoto")) {
    event.preventDefault();
    openPicker();
  }
});

input?.addEventListener("change", () => {
  const file = input.files?.[0];
  if (file) uploadGroupImage(file);
});

viewer?.addEventListener("transitionend", () => {
  if (!viewer.hidden) prepareViewer();
});

window.addEventListener("evara:session-ready", () => {
  setControlsEnabled(false);
});
