"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";

/**
 * 弊社担当者の入力欄。保存済みの担当者名をチップで出し、クリックで入力
 * (もう一度クリックで解除)。新しい名前は今まで通り自由入力。
 */
export function OwnerNameField({
  options,
  defaultValue,
}: {
  options: string[];
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <Input
        id="owner_name"
        name="owner_name"
        placeholder="白石"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {options.map((name) => (
            <Chip
              key={name}
              selected={value === name}
              onClick={() => setValue(value === name ? "" : name)}
              className="h-7 px-3 text-xs"
            >
              {name}
            </Chip>
          ))}
        </div>
      )}
    </>
  );
}
