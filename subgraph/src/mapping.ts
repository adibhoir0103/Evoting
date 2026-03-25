import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  CandidateAdded,
  VoterAuthorized,
  VoteCast,
  VotingStatusChanged,
  VotingTimelineSet,
} from "../generated/Voting/Voting";
import {
  Candidate,
  Vote,
  Voter,
  VotingStatus,
  VotingTimeline,
  ElectionSummary,
} from "../generated/schema";

export function handleCandidateAdded(event: CandidateAdded): void {
  let id = event.params.candidateId.toString();
  let candidate = new Candidate(id);
  candidate.candidateId = event.params.candidateId;
  candidate.name = event.params.name;
  candidate.partyName = event.params.partyName;
  candidate.stateCode = event.params.stateCode;
  candidate.constituencyCode = event.params.constituencyCode;
  candidate.voteCount = BigInt.fromI32(0);
  candidate.createdAt = event.block.timestamp;
  candidate.blockNumber = event.block.number;
  candidate.save();

  // Update election summary
  let summary = ElectionSummary.load("1");
  if (!summary) {
    summary = new ElectionSummary("1");
    summary.totalVotes = BigInt.fromI32(0);
    summary.totalZKPVotes = BigInt.fromI32(0);
    summary.totalCandidates = BigInt.fromI32(0);
    summary.zkpEnabled = false;
  }
  summary.totalCandidates = summary.totalCandidates.plus(BigInt.fromI32(1));
  summary.lastUpdated = event.block.timestamp;
  summary.save();
}

export function handleVoterAuthorized(event: VoterAuthorized): void {
  let id = event.params.voter.toHexString();
  let voter = new Voter(id);
  voter.address = event.params.voter;
  voter.stateCode = event.params.stateCode;
  voter.constituencyCode = event.params.constituencyCode;
  voter.isAuthorized = true;
  voter.hasVoted = false;
  voter.authorizedAt = event.block.timestamp;
  voter.save();
}

export function handleVoteCast(event: VoteCast): void {
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let vote = new Vote(id);
  vote.voter = event.params.voter;
  vote.candidateId = event.params.candidateId;
  vote.timestamp = event.block.timestamp;
  vote.blockNumber = event.block.number;
  vote.transactionHash = event.transaction.hash;
  vote.save();

  // Update candidate vote count
  let candidate = Candidate.load(event.params.candidateId.toString());
  if (candidate) {
    candidate.voteCount = candidate.voteCount.plus(BigInt.fromI32(1));
    candidate.save();
  }

  // Update voter status
  let voter = Voter.load(event.params.voter.toHexString());
  if (voter) {
    voter.hasVoted = true;
    voter.save();
  }

  // Update election summary
  let summary = ElectionSummary.load("1");
  if (summary) {
    summary.totalVotes = summary.totalVotes.plus(BigInt.fromI32(1));
    summary.lastUpdated = event.block.timestamp;
    summary.save();
  }
}

export function handleVotingStatusChanged(event: VotingStatusChanged): void {
  let status = new VotingStatus("current");
  status.isActive = event.params.isActive;
  status.updatedAt = event.block.timestamp;
  status.save();
}

export function handleVotingTimelineSet(event: VotingTimelineSet): void {
  let timeline = new VotingTimeline("current");
  timeline.startTime = event.params.startTime;
  timeline.endTime = event.params.endTime;
  timeline.setAt = event.block.timestamp;
  timeline.save();
}
