export interface AccessControlConfig {
  allowedUserIds: number[];
  enabled: boolean;
}

export const createAccessControlConfig = (): AccessControlConfig => {
  const allowedUserIdsStr = process.env.ALLOWED_USER_IDS || '';
  const allowedUserIds = allowedUserIdsStr
    .split(',')
    .map(id => parseInt(id.trim(), 10))
    .filter(id => !isNaN(id));

  return {
    allowedUserIds,
    enabled: process.env.ACCESS_CONTROL_ENABLED !== 'false' && allowedUserIds.length > 0
  };
};

export const defaultAccessControlConfig: AccessControlConfig = {
  allowedUserIds: [],
  enabled: false
};
