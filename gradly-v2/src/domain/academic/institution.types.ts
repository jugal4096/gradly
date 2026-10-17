export interface Institution {
    id: string;
    name: string;
    shortName?: string;
    universityId?: string;
    autonomous: boolean;
    country: string;
    state?: string;
    city?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  }