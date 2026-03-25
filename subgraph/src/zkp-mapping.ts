import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  ZKPVoteSubmitted,
  VoterRegistered,
  VoteVerified,
  ZKPModeChanged,
  CandidateMetadataStored,
} from "../generated/ZKPVoting/ZKPVoting";
import {
  ZKPVote,
  EligibleVoter,
  VoteVerification,
  ZKPStatus,
  CandidateMetadata,
  ElectionSummary,
} from "../generated/schema";

export function handleZKPVoteSubmitted(event: ZKPVoteSubmitted): void {
  let id = event.params.nullifierHash.toHexString();
  let vote = new ZKPVote(id);
  vote.nullifierHash = event.params.nullifierHash;
  vote.commitment = event.params.commitment;
  vote.ipfsHash = event.params.ipfsHash;
  vote.timestamp = event.params.timestamp;
  vote.verified = false;
  vote.blockNumber = event.block.number;
  vote.transactionHash = event.transaction.hash;
  vote.save();

  // Update election summary
  let summary = ElectionSummary.load("1");
  if (summary) {
    summary.totalZKPVotes = summary.totalZKPVotes.plus(BigInt.fromI32(1));
    summary.lastUpdated = event.block.timestamp;
    summary.save();
  }
}

export function handleVoterRegistered(event: VoterRegistered): void {
  let id = event.params.identityCommitment.toHexString();
  let voter = new EligibleVoter(id);
  voter.identityCommitment = event.params.identityCommitment;
  voter.registeredAt = event.block.timestamp;
  voter.blockNumber = event.block.number;
  voter.save();
}

export function handleVoteVerified(event: VoteVerified): void {
  let id = event.params.nullifierHash.toHexString();
  let verification = new VoteVerification(id);
  verification.nullifierHash = event.params.nullifierHash;
  verification.isValid = event.params.valid;
  verification.verifiedAt = event.block.timestamp;
  verification.save();

  // Update the ZKP vote as verified
  let vote = ZKPVote.load(id);
  if (vote) {
    vote.verified = true;
    vote.save();
  }
}

export function handleZKPModeChanged(event: ZKPModeChanged): void {
  let status = new ZKPStatus("current");
  status.enabled = event.params.enabled;
  status.updatedAt = event.block.timestamp;
  status.save();

  // Update election summary
  let summary = ElectionSummary.load("1");
  if (summary) {
    summary.zkpEnabled = event.params.enabled;
    summary.lastUpdated = event.block.timestamp;
    summary.save();
  }
}

export function handleCandidateMetadataStored(event: CandidateMetadataStored): void {
  let id = event.params.candidateId.toString();
  let metadata = new CandidateMetadata(id);
  metadata.candidateId = event.params.candidateId;
  metadata.ipfsHash = event.params.ipfsHash;
  metadata.storedAt = event.block.timestamp;
  metadata.save();
}
