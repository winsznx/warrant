// TypeScript Type definitions for Warrant Agent

export interface ProofPayload {
  imageUrl?: string;
  lat?: number;
  lng?: number;
  prUrl?: string;
  description?: string;
}

export interface ReceiptRule {
  maxAmount: number;
  merchant?: string;
}

export interface DeliveryRule {
  targetLat: number;
  targetLng: number;
  radiusMeters: number;
}

export interface MilestoneRule {
  owner: string;
  repo: string;
  branch: string;
}
