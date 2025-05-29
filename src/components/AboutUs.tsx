import '../custom_styles.css'

function AboutUs() {
  return (
    <div className="prose max-w-none bg-white p-6 shadow overflow-y-auto min-h-full">
      <div className="about_container">
        <h1>MyOrgWallet.io</h1>

        <h2> Manage <b>your</b> organization's digital identity, credentials, and profile; store them securely within your MetaMask wallet, and publish organizational attestations on the smart web. </h2>

        <p><a className="colored_link" href="https://youtu.be/2WAkvM0JogA"> See MyOrgWallet in action. </a></p>

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

        <h2> Some Definitions </h2>

        <p><b>Decentralized Applications (DApps)</b> are applications that can operate autonomously and run most commonly on a blockchain. DApps usually operate with minimal human intervention and are not owned by a single entity. </p>
        <p><b>Decentralized Identifiers (DIDs)</b> are a type of identifier that associate a subject (a person, organization, or thing) with a verified document, allowing trustable interactions associated with that subject. The "decentralized" part in the name comes from the fact that DIDs are not controlled by a central authority and are instead controlled by the individual, allowing more control over what information is shared and with who. </p>
        <p><b>Attestations</b> are evidence or proof of something. Web3 attestations contain digital signatures and cryptographic proofs that state a fact about an identity or entity. These proofs can prove a specific identity, confirm trustworthiness, or demonstrate that certain criteria have been met. </p>
        <p><b>Crypto Wallets</b> store public and/or private keys for cryptographic transactions. </p>
        <p><b>Smart Wallets</b> are crypto wallets powered by a smart contract on the blockchain. </p>
        <p><b>Smart Contracts</b> are a digital contract that are automatically executed when certain predetermined conditions have been met. They eliminate the need for intermediaries by directly executing agreements after conditions are met. </p>
        <p><b>Blockchains</b> are a way of storing data in "blocks" linked together in a linear "chain." They are, in essence, a database of transactions. This "block-chain" acts like a distributed ledger as these records cannot be modified or deleted, thus proving a chronological and sequential order. </p>
        <p><b>Ethereum</b> is a public decentralized blockchain with smart contract functionality. </p>
        <p><b>Verifiable Credentials (VCs)</b> are tamper-proof digital files that contain verified information about a person, organization, or thing. Verifiable credentials offer a faster, more secure, and privacy-preserving way to prove information. Zero-knowledge proofs are used to enhance the security and privacy of verifiable credentials. </p>
        <p><b>Zero-Knowledge Proofs (ZKPs)</b> are a cryptographic method used to prove, or convince, that a statement is true without exposing the actual statement. The "zero" in zero-knowledge proof comes from the fact that nothing extra is exposed related to the statement when used. ZKPs are useful in situations where privacy and anonymity are critical. </p>
      </div>
    </div>
  )
}

export default AboutUs;