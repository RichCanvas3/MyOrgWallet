import '../custom_styles.css'

function AboutUs() {
  return (
    <div className="prose max-w-none bg-white p-6 shadow overflow-y-auto min-h-full">
      <div className="about_container">
        <h1>MyWalletOrg.io</h1>

        <h2> Manage <b>your</b> organization's digital identity, credentials, and profile; store them securely within your MetaMask wallet, and publish proof of ownership on the smart web. </h2>

        <h2>How It Works</h2>

        <ol>
          <li> Create a local wallet (EOA) using <a className="colored_link" href="https://metamask.io/" target="_blank">MetaMask</a>. Watch <a className="colored_link" href="https://youtu.be/BI3S2YsL-po" target="_blank">How to Set Up MetaMask</a>. </li>
          <li> Configure your MetaMask account within the browser and set up OP Mainnet. Watch <a className="colored_link" href="https://youtu.be/nVbJUDLtYCM" target="_blank">How to Configure OP Mainnet</a>. </li>
          <li> Visit <a className="colored_link" href="https://myorgwallet.io/" target="_blank">MyOrgWallet.io</a> and create your on-chain organizational and individual smart wallets using MetaMask. Watch <a className="colored_link" href="https://youtu.be/B5mAdz4A5Y8" target="_blank">How to Create Smart Wallets on MyOrgWallet</a>. </li>
          <li> Create attestations, or verified proofs, about digital information for your organization, either manually or through our AI-powered chat bot. Some examples of attestations include:
            <ul>
              <li> Verified proofs for company social media accounts (LinkedIn, Facebook, YouTube). </li>
              <li> Verified proofs of state business registration web page. </li>
              <li> Verified proofs for regulation compliance. </li>
            </ul>
          </li>
          <li> Invite other leaders from your organization and give them access to create attestations. </li>
          <li> Explore other organizations and view their attestations. </li>
        </ol>

        <p><b>MyOrgWallet.io</b> - Verified, secure, and accurate digital information about your business, ready for Web 3.0. </p>

        <h2> Some Definitions </h2>

        <p><b>Decentralized applications</b>, also known as (DApps) are applications that can operate autonomously and run most commonly on a blockchain. DApps usually operate with minimal human intervention and are not owned by a single entity. </p>
        <p> A <b>crypto wallet</b> stores public and/or private keys for cryptographic transactions. </p>
        <p> A <b>smart wallet</b> is a crypto wallet powered by a smart contract on the blockchain. </p>
        <p> A <b>smart contract</b> is a digital contract, or software program, that is automatically executed when certain predetermined conditions are met. </p>
        <p> A <b>blockchain</b> is a way of storing data in blocks that are linked together in a chain. It is, in essence, a database of transactions. This "block chain" acts like a distributed ledger as these records cannot be modified or deleted, thus proving a chronological and sequential order. </p>
        <p> <b>Ethereum</b> is a public decentralized blockchain with smart contract functionality. </p>

        <h2> Zero-Knowledge Proofs </h2>

        <p> A <b>zero-knowledge proof</b>, or ZKP, is a cryptographic method used to prove, or convince, that a statement is true without exposing the actual statement. The "zero" in zero-knowledge proof comes from the fact that nothing extra is exposed related to the statement. </p>
      </div>
    </div>
  )
}

export default AboutUs;