function AboutUs() {
  return (
    <div className="prose max-w-none bg-white p-6 rounded shadow max-h-[80vh] overflow-y-auto min-h-0">
      <h1>About Us (In Progress)</h1>

      <p> MyOrgWallet is an application that lets organizations create smart wallets for their organization and leaders of the organization. </p>
      <p> Within these wallets, users can create and publish business attestations, digital proof or evidence of things specifically related to the organization. These proofs are then signed by the app and stored on the Ethereum blockchain. </p>

      <h2> Definitions </h2>

      <p><b>Decentralized applications</b>, also known as (DApps) are applications that can operate autonomously and run most commonly on the blockchain, a distributed ledger with a continuously growing list of records (blocks). Each of these blocks are linked together by a cryptographic hash of the previous block in the chain, and contains a timestamp and data. DApps usually operate with minimal human intervention and are not owned by a single entity. </p>
      <p> A <b>smart wallet</b> is a crypto wallet powered by a smart contract on the blockchain. </p>
      <p> A <b>cryptocurrency wallet</b>, or crypto wallet, stores public and/or private keys for cryptocurrency transactions. Crypto wallets keep cryptocurrency safe, and allow the owner of the wallet to spend, send, or save their cryptocurrency. </p>
      <p> The <b>blockchain</b> is a distributed ledger with a continuously growing list of records (blocks). Each of these blocks are linked together with a cryptographic hash of the previous block in the chain, and contains a timestamp and data. </p>

      <h2> Zero-Knowledge Proofs </h2>

      <p> A zero-knowledge proof, or ZKP, is a cryptographic method used in to prove, or convince, that a statement is true without exposing the actual statement. </p>
      <p> For example, let's use Dave's Auto Repair. Dave's Auto Repair is a repair shop owned by Dave that's registered in the state of California. This is factually true - Dave has physical business license to prove it. </p>
      <p> How can Dave convince you with certainty that his repair shop does in fact have a California business license, but without actually showing you? </p>
      <p> A ZKP is the answer. ZKPs only expose whether a statement is true or not - true or false. The "zero" in zero-knowledge proof comes from the fact that nothing extra is exposed about Dave's Auto Repair. A ZKP doesn't expose about Dave's personal information, or the number of employees he has, or what his yearly financials look like. It only proves whether a statement is true or not. You would be convinced that Dave's Repair Shop has a California business license if you received a piece of paper that said "Does Dave's Auto Repair have a California business license? Yes."  </p>

      <p> There are three big players when it comes to ZKPs - the prover, the verifier, and the issuer. </p>

      <ul>
        <li> The Prover - In this example, Dave is the prover. </li>
        <li> The Verifier - You are the verifier. Dave is trying to convince you. </li>
        <li> The Issuer - The state of California. They have definitive proof whether Dave's Auto Repair is licensed in their state. </li>
      </ul>

      <p> In essence, a ZKP is a way to convince another party that a statement is true. </p>
    </div>
  )
}

export default AboutUs;