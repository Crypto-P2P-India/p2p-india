import { useState } from "react";
import { useAccount, useChainId, useDeployContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { bsc } from "wagmi/chains";
import { isAddress } from "viem";
import { Rocket, ExternalLink, Copy, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { SELL_ESCROW_ABI, SELL_ESCROW_BYTECODE } from "@/config/sellEscrowArtifact";

/**
 * One-click deploy of SellEscrow.sol from the connected wallet.
 * The user's wallet pays gas and becomes the contract owner.
 */
export default function DeployContractCard() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [feeCollector, setFeeCollector] = useState<string>("");
  const [deployedAddress, setDeployedAddress] = useState<string>("");

  const { deployContractAsync, data: txHash, isPending } = useDeployContract();
  const { isLoading: confirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

  if (isSuccess && receipt?.contractAddress && receipt.contractAddress !== deployedAddress) {
    setDeployedAddress(receipt.contractAddress);
  }

  const onDeploy = async () => {
    if (!isConnected) return toast.error("Connect your wallet first");
    const collector = (feeCollector || address || "").trim();
    if (!isAddress(collector)) return toast.error("Enter a valid fee-collector address (0x…)");

    try {
      if (chainId !== bsc.id) {
        toast.info("Switching to BNB Smart Chain…");
        await switchChainAsync({ chainId: bsc.id });
      }
      toast.info("Confirm the deployment in your wallet…");
      await deployContractAsync({
        abi: SELL_ESCROW_ABI as any,
        bytecode: SELL_ESCROW_BYTECODE as `0x${string}`,
        args: [collector as `0x${string}`],
      });
    } catch (e: any) {
      toast.error(e?.shortMessage || e?.message || "Deployment failed");
    }
  };

  const copy = (v: string) => {
    navigator.clipboard.writeText(v);
    toast.success("Copied");
  };

  return (
    <Card className="bg-card border-primary/30 mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Rocket className="h-4 w-4 text-primary" /> Deploy New Escrow Contract
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            Your connected wallet will pay gas (~$0.30 in BNB) and will become the contract <b>owner</b>.
            Deploys on <b>BNB Smart Chain Mainnet</b>.
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fc" className="text-xs">Fee collector address</Label>
          <Input
            id="fc"
            placeholder={address || "0x…"}
            value={feeCollector}
            onChange={(e) => setFeeCollector(e.target.value)}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            Leave blank to use your connected wallet. Receives the 0.15% / 0.10% protocol fees.
          </p>
        </div>

        <Button
          onClick={onDeploy}
          disabled={!isConnected || isPending || confirming}
          className="w-full gap-2"
        >
          <Rocket className="h-4 w-4" />
          {isPending ? "Waiting for wallet…" : confirming ? "Confirming on-chain…" : "Deploy Contract"}
        </Button>

        {txHash && (
          <a
            href={`https://bscscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1 break-all"
          >
            View tx <ExternalLink className="h-3 w-3" />
          </a>
        )}

        {deployedAddress && (
          <div className="rounded-md bg-green-500/10 border border-green-500/30 p-3 space-y-2">
            <div className="flex items-center gap-2 text-green-400 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" /> Deployed!
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono break-all flex-1">{deployedAddress}</code>
              <Button size="icon" variant="ghost" onClick={() => copy(deployedAddress)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Copy this address and paste it into <code>src/config/wagmi.ts</code> as{" "}
              <code>P2P_CONTRACT_ADDRESS</code>, then ask me to update it.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
