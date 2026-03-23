/** Access JWT em memória (não persiste em localStorage — reduz impacto de XSS). */
let accessToken = null;

export const setAccessToken = (t) => {
  accessToken = t || null;
};

export const getAccessToken = () => accessToken;

export const clearAccessToken = () => {
  accessToken = null;
};
