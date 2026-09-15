import { useState } from "react";

export default function PasswordInput({ className = "input", ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={visible ? "text" : "password"} className={`${className} !pr-10`} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-0 right-2.5 flex items-center text-[#98A2B3] hover:text-[#2554C7]"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        <i className={`ti ${visible ? "ti-eye-off" : "ti-eye"} text-base`} aria-hidden="true" />
      </button>
    </div>
  );
}
