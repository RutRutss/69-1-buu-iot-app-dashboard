"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { auth, db } from "./firebase";

export type Reading = {
  id: string;
  /** Epoch milliseconds. */
  t: number;
  temperature: number | null;
  airHumidity: number | null;
  /** Percent, converted from the raw sensor value. */
  soilMoisture: number | null;
};

export type RangeKey = "day" | "month" | "year";

type State = {
  key: RangeKey | null;
  readings: Reading[];
  error: string | null;
};

// Calibration for the analog soil probe: raw reading in open air (dry) and
// submerged in water (wet). Higher raw = drier. Estimates until measured.
const SOIL_DRY_RAW = 1024;
const SOIL_WET_RAW = 400;

function soilPercent(raw: number | null) {
  if (raw === null) return null;
  const percent =
    ((SOIL_DRY_RAW - raw) / (SOIL_DRY_RAW - SOIL_WET_RAW)) * 100;
  return Math.min(100, Math.max(0, percent));
}

// The device writes `timestamp` as wall time in this zone, so range
// boundaries have to be computed in it too.
const DEVICE_TIME_ZONE = "Asia/Bangkok";

// Upper bound on documents read per range, to keep Firestore reads in check.
const MAX_READINGS = 5000;

const deviceDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: DEVICE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** First `timestamp` string belonging to the current day / month / year. */
function rangeStart(range: RangeKey) {
  const today = deviceDateFormat.format(new Date()); // YYYY-MM-DD
  if (range === "day") return `${today} 00:00:00`;
  if (range === "month") return `${today.slice(0, 7)}-01 00:00:00`;
  return `${today.slice(0, 4)}-01-01 00:00:00`;
}

const toNumber = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

// Document IDs are `log_<epoch seconds>`, which is the unambiguous instant.
// The `timestamp` string is device-local wall time, so it is only a fallback.
function readingTime(id: string, data: DocumentData) {
  const epoch = /^log_(\d{9,11})$/.exec(id)?.[1];
  if (epoch) return Number(epoch) * 1000;
  if (typeof data.timestamp === "string") {
    const parsed = Date.parse(data.timestamp.replace(" ", "T"));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

function describeError(code: string) {
  if (code === "permission-denied") {
    return "Firestore ปฏิเสธการอ่านข้อมูล — ตรวจสอบ Security Rules ของ collection sensor_data ให้อนุญาต read";
  }
  if (
    code === "auth/admin-restricted-operation" ||
    code === "auth/operation-not-allowed"
  ) {
    return "ล็อกอินแบบ Anonymous ไม่ได้ — เปิดใช้ Anonymous ใน Firebase Console → Authentication → Sign-in method";
  }
  if (code === "unavailable") {
    return "เชื่อมต่อ Firestore ไม่ได้ — ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต";
  }
  return `อ่านข้อมูลจาก Firestore ไม่สำเร็จ (${code})`;
}

/** Live subscription to the readings of the current day / month / year, oldest → newest. */
export function useSensorData(range: RangeKey) {
  const [state, setState] = useState<State>({
    key: null,
    readings: [],
    error: null,
  });

  useEffect(() => {
    const q = query(
      collection(db, "sensor_data"),
      where("timestamp", ">=", rangeStart(range)),
      orderBy("timestamp", "desc"),
      limit(MAX_READINGS),
    );
    const fail = (error: { code?: string }) =>
      setState({
        key: range,
        readings: [],
        error: describeError(error.code ?? "unknown"),
      });

    let unsubscribeData: (() => void) | undefined;

    // Security rules require a signed-in user, so subscribe only once the
    // anonymous session exists.
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeData?.();
      unsubscribeData = undefined;
      if (!user) {
        signInAnonymously(auth).catch(fail);
        return;
      }
      unsubscribeData = onSnapshot(
        q,
        (snapshot) => {
          const readings: Reading[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            const t = readingTime(doc.id, data);
            if (t === null) return;
            readings.push({
              id: doc.id,
              t,
              temperature: toNumber(data.temperature),
              airHumidity: toNumber(data.airHumidity),
              soilMoisture: soilPercent(toNumber(data.soilMoisture)),
            });
          });
          readings.sort((a, b) => a.t - b.t);
          setState({ key: range, readings, error: null });
        },
        fail,
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeData?.();
    };
  }, [range]);

  return {
    readings: state.readings,
    error: state.error,
    loading: state.key !== range,
    /** The range the current `readings` belong to. */
    loadedRange: state.key,
    truncated: state.readings.length >= MAX_READINGS,
  };
}
