"use client";

type ReminderNotification = {
  body: string;
  title: string;
  url?: string;
};

export async function requestReminderNotification({ body, title, url }: ReminderNotification) {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return "unsupported" as const;
  }

  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;

  if (permission !== "granted") {
    return permission;
  }

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    body,
    data: {
      url
    },
    tag: "cultipilot-reminder"
  });

  return permission;
}
