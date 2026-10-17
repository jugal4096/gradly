export interface Course {
    id: string;
    institutionId: string;
    canonicalCode?: string;
    canonicalName: string;
    description?: string;
    active: boolean;
    createdAt: string;
    updatedAt: string;
  }