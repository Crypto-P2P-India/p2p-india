import { useState } from "react";
import { Download, Smartphone, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";

// Direct APK download URL. Replace this with your hosted APK link
// (e.g. your own server, GitHub Releases, Google Drive direct link, etc.).
const APK_URL = "/downloads/crypto-p2p.apk";
const APK_VERSION = "1.5";
const APK_SIZE = "~12 MB";

const ApkDownloadButton = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="hidden sm:inline-flex h-9 gap-1.5 rounded-xl bg-gradient-to-r from-primary to-primary/80 px-3 font-semibold shadow-sm hover:shadow-md transition-all"
        >
          <Download className="h-4 w-4" />
          <span>Get App</span>
        </Button>
      </DialogTrigger>
      {/* Mobile compact icon button */}
      <DialogTrigger asChild>
        <Button
          size="icon"
          className="sm:hidden h-9 w-9 rounded-xl bg-gradient-to-r from-primary to-primary/80"
          aria-label="Download Android app"
        >
          <Download className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-background shadow-lg border border-primary/20 flex items-center justify-center overflow-hidden">
              <img src="/favicon.png" alt="Crypto P2P" className="h-12 w-12" />
            </div>
            <div className="flex-1">
              <DialogHeader className="space-y-1 text-left">
                <DialogTitle className="text-xl font-extrabold tracking-tight">
                  Crypto P2P India
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Android APK · v{APK_VERSION} · {APK_SIZE}
                </DialogDescription>
              </DialogHeader>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6 space-y-4">
          <div className="space-y-2">
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Install directly — no Play Store account needed</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Signed by the official Crypto P2P team</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Smartphone className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span>Works on Android 7.0 and above</span>
            </div>
          </div>

          <a
            href={APK_URL}
            download
            className="block"
            onClick={() => setOpen(false)}
          >
            <Button className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-base font-bold shadow-md hover:shadow-lg">
              <Download className="h-5 w-5 mr-2" />
              Download APK
            </Button>
          </a>

          <div className="rounded-lg bg-muted/50 border border-border/50 p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">
              How to install:
            </p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Tap "Download APK" on your Android phone</li>
              <li>Open the downloaded file</li>
              <li>Allow "Install from unknown sources" if prompted</li>
              <li>Tap Install — you're done!</li>
            </ol>
          </div>

          <p className="text-[10px] text-center text-muted-foreground">
            iOS users: use the web app at{" "}
            <span className="text-primary font-medium">crypto-p2p.store</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApkDownloadButton;
