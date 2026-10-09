// Fresh demo accounts in under a minute (e.g. after a testnet reset): a funded owner holding XLM and
// 250 RIK (a test asset), and a funded heir. Secrets go to demo-accounts.local.json (git-ignored) for
// importing into Freighter → "Import a Stellar secret key". Run: pnpm seed-demo
import { writeFileSync } from "node:fs";
import { Asset, BASE_FEE, Horizon, Keypair, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { NETWORKS } from "../lib/core/config";

const server = new Horizon.Server(NETWORKS.testnet.horizon);
const PASS = NETWORKS.testnet.passphrase;
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));

async function fund(kp: Keypair) {
  for (let i = 0; i < 6; i++) {
    try { if ((await fetch(`${NETWORKS.testnet.friendbot}?addr=${kp.publicKey()}`)).ok) return; } catch { /* retry */ }
    await sleep(3);
  }
  throw new Error("friendbot failed");
}

async function main() {
  const owner = Keypair.random(), heir = Keypair.random(), issuer = Keypair.random();
  console.log("Funding owner, heir and asset issuer…");
  await Promise.all([fund(owner), fund(heir), fund(issuer)]);
  const RIK = new Asset("RIK", issuer.publicKey());

  const trust = new TransactionBuilder(await server.loadAccount(owner.publicKey()), { fee: BASE_FEE, networkPassphrase: PASS })
    .addOperation(Operation.changeTrust({ asset: RIK })).setTimeout(300).build();
  trust.sign(owner);
  await server.submitTransaction(trust);
  const issue = new TransactionBuilder(await server.loadAccount(issuer.publicKey()), { fee: BASE_FEE, networkPassphrase: PASS })
    .addOperation(Operation.payment({ destination: owner.publicKey(), asset: RIK, amount: "250" })).setTimeout(300).build();
  issue.sign(issuer);
  await server.submitTransaction(issue);

  const file = "demo-accounts.local.json";
  writeFileSync(file, JSON.stringify({
    network: "testnet", createdAt: new Date().toISOString(),
    owner: { public: owner.publicKey(), secret: owner.secret(), holds: "10,000 XLM + 250 RIK" },
    heir: { public: heir.publicKey(), secret: heir.secret(), holds: "10,000 XLM" },
    asset: { code: "RIK", issuer: issuer.publicKey() },
  }, null, 2));
  console.log(`\nOwner ${owner.publicKey()}  (10,000 XLM + 250 RIK)`);
  console.log(`Heir  ${heir.publicKey()}  (10,000 XLM)`);
  console.log(`\nSecret keys saved to ${file} (git-ignored). Import both into Freighter on Testnet.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
