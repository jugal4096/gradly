export interface Department {
    id: string;
    institutionId: string;
    name: string;
    code?: string;
    type: "DEPARTMENT" | "BRANCH";
    active: boolean;
    createdAt: string;
    updatedAt: string;
  }