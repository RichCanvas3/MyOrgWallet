import { MerkleTree } from 'merkletreejs';
import { sha256 } from 'js-sha256';

// Class to manage a Merkle Tree of revoked keys
export class VcCommitmentValidator {

    private static revokedKeys: string[] = [];
    private static tree: any | undefined;

  
  constructor() {
    console.info("..................... INIT REVOKED KEYS ..............")
    //VcCommitmentValidator.revokedKeys = [...initialKeys]; // Store revoked keys
    VcCommitmentValidator.tree = this.buildTree(VcCommitmentValidator.revokedKeys); // Initial Merkle Tree
  }

  // Build or rebuild the Merkle Tree from the list of revoked keys
  buildTree(keys : string[]) {
    if (keys.length === 0) {
      return null; // No keys, no tree
    }

    // Hash each key to create leaves
    const leaves = keys.map(key => sha256(key));
    
    // Create the Merkle Tree
    const tree = new MerkleTree(leaves, sha256, {
      sortPairs: true, // Sort pairs for consistency
    });
    
    return tree;
  }

  // Get the Merkle Root
  getRoot() {
    return VcCommitmentValidator.tree ? VcCommitmentValidator.tree.getRoot().toString('hex') : null;
  }

  removeRevokedKey(key: string) {

    VcCommitmentValidator.revokedKeys = VcCommitmentValidator.revokedKeys.filter(item => item !== key)
    console.info("revoked keys: ", VcCommitmentValidator.revokedKeys)
    VcCommitmentValidator.tree = this.buildTree(VcCommitmentValidator.revokedKeys);

  }

  // Add a new revoked key and update the tree
  addRevokedKey(key : string) {
    if (VcCommitmentValidator.revokedKeys.includes(key)) {
      console.log(`Key ${key} is already revoked.`);
      return false;
    }

    VcCommitmentValidator.revokedKeys.push(key);
    VcCommitmentValidator.tree = this.buildTree(VcCommitmentValidator.revokedKeys);
    console.log(`Added key ${key}. New root: ${this.getRoot()}`);
    return true;
  }

  // Generate a proof for a specific key
  getProof(key : string) {
    const leaf = sha256(key);
    return VcCommitmentValidator.tree ? VcCommitmentValidator.tree.getProof(leaf) : [];
  }

  // Verify if a key is revoked
  isKeyRevoked(key : string, proof = null) {
    if (!VcCommitmentValidator.tree) {
      return false; // No tree means no revoked keys
    }

    const leaf = sha256(key);
    const root = this.getRoot();

    // If no proof provided, generate it
    proof = proof || this.getProof(key);

    // Verify the proof against the root
    console.info("proof: ", proof)
    console.info("leaf: ", leaf)
    console.info("root: ", root)

    const isValid = VcCommitmentValidator.tree.verify(proof, leaf, root);
    return isValid && VcCommitmentValidator.revokedKeys.includes(key);
  }

  // For debugging: Print the tree structure
  printTree() {
    if (!VcCommitmentValidator.tree) {
      console.log("No tree exists.");
      return;
    }
    console.log("Merkle Root:", this.getRoot());
    console.log("Leaves:", VcCommitmentValidator.tree.getLeaves().map(l => l.toString('hex')));
  }
}