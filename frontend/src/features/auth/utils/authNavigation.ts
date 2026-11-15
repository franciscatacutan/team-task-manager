/** A hard navigation also discards mounted private application state. */
export const redirectToLogin = () => {
  window.location.href = "/login";
};
