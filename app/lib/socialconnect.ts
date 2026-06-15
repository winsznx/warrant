/**
 * SocialConnect / ODIS phone-number -> Celo wallet resolution (SERVER ONLY).
 *
 * Loaded dynamically by app/api/resolve-phone only when an issuer key is
 * configured, so the heavy `@celo/identity` WASM dependency never enters the
 * client bundle or runs on unconfigured deployments.
 *
 * Requires a funded issuer with ODIS quota (cUSD approved to OdisPayments).
 * Env: SOCIALCONNECT_ISSUER_PRIVATE_KEY, SOCIALCONNECT_RPC_URL (optional).
 */
import { federatedAttestationsABI } from "@celo/abis";
import { OdisUtils } from "@celo/identity";
import { OdisContextName } from "@celo/identity/lib/odis/query.js";
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

// FederatedAttestations proxy + known trusted issuers (Celo mainnet).
const FA_ADDRESS = "0x0aD5b1d0C25ecF6266Dd951403723B2687d6aff2" as const;
const TRUSTED_ISSUERS: Address[] = [
  "0x6549aF2688e07907C1b821cA44d6d65872737f05", // Kaala
  "0x388612590F8cC6577F19c9b61811475Aa432CB44", // Libera
  "0x7888612486844Bb9BE598668081c59A9f7367FBc", // MiniPay
];

const issuer = privateKeyToAccount(process.env.SOCIALCONNECT_ISSUER_PRIVATE_KEY as Hex);
const rpcUrl = process.env.SOCIALCONNECT_RPC_URL ?? "https://forno.celo.org";

const walletClient = createWalletClient({ account: issuer, chain: celo, transport: http(rpcUrl) });
const publicClient = createPublicClient({ chain: celo, transport: http(rpcUrl) });

// WALLET_KEY auth signer: ODIS authenticates the issuer via an EIP-191 signature.
const authSigner = {
  authenticationMethod: OdisUtils.Query.AuthenticationMethod.WALLET_KEY,
  sign191: ({ message }: { message: string; account: Address }) =>
    walletClient.signMessage({ message, account: issuer }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const serviceContext = OdisUtils.Query.getServiceContext(OdisContextName.MAINNET);

const faContract = getContract({
  abi: federatedAttestationsABI,
  address: FA_ADDRESS,
  client: publicClient,
});

/** Resolve an E.164 phone number to the first attested wallet address, or null. */
export async function resolvePhoneToAddress(e164Phone: string): Promise<Address | null> {
  const { obfuscatedIdentifier } = await OdisUtils.Identifier.getObfuscatedIdentifier(
    e164Phone,
    OdisUtils.Identifier.IdentifierPrefix.PHONE_NUMBER,
    issuer.address,
    authSigner,
    serviceContext,
  );

  const result = (await faContract.read.lookupAttestations([
    obfuscatedIdentifier as Hex,
    TRUSTED_ISSUERS,
  ])) as readonly [readonly bigint[], readonly Address[], readonly Address[], readonly bigint[], readonly bigint[]];

  const accounts = result[1];
  return accounts.length > 0 ? accounts[0] : null;
}
