"use client";

import { type RefObject, useEffect, useState } from "react";

/** 同じフォームの select[name=stage] がトライアル中か。トライアル中だけ必須にする欄で使う */
export function useTrialStage(ref: RefObject<HTMLElement | null>): boolean {
  const [trial, setTrial] = useState(false);
  useEffect(() => {
    const stage = ref.current
      ?.closest("form")
      ?.querySelector<HTMLSelectElement | HTMLInputElement>('[name="stage"]');
    if (!stage) return;
    const sync = () => setTrial(stage.value === "trial");
    sync();
    stage.addEventListener("change", sync);
    return () => stage.removeEventListener("change", sync);
  }, [ref]);
  return trial;
}
