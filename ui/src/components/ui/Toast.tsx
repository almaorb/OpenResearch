import type { ComponentProps } from "react";
import { type ExternalToast, Toaster as SonnerToaster, toast } from "sonner";
import { useResolvedTheme } from "../../theme";

export type ToastVariant = "success" | "info" | "warning" | "error";

export function Toaster(props: ComponentProps<typeof SonnerToaster>) {
  const theme = useResolvedTheme();
  return <SonnerToaster theme={theme} {...props} />;
}

export function showAlert(message: string, type: ToastVariant, options?: ExternalToast) {
  toast[type](message, {
    duration: type === "warning" || type === "error" ? Infinity : 5000,
    position: "top-center",
    closeButton: true,
    ...options,
  });
}
