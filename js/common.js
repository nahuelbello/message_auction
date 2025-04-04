/**
 * Returns a custom error message based on the error message and context.
 * @param {Error} err - The error object.
 * @param {string} context - The context in which the error occurred.
 * @returns {string} - The custom error message.
 */
function getCustomErrorMessage(err, context) {
  const message = err.message || "";
  if (context === "placeBid") {
    if (message.includes("New bid must exceed current bid"))
      return "Your bid must exceed the current bid by at least 0.01 ETH.";
    else if (message.includes("Initial bid must be"))
      return "Your initial bid must be at least 0.01 ETH.";
    else if (message.includes("Founder fee transfer failed"))
      return "Failed to transfer founder fee. Please try again.";
  } else if (context === "withdraw") {
    if (message.includes("No shares"))
      return "You have no shares.";
    else if (message.includes("No funds to withdraw"))
      return "There are no funds available for withdrawal.";
    else if (message.includes("Withdrawal failed"))
      return "Withdrawal failed. Please try again.";
  } else if (context === "simulate") {
    if (message.includes("invalid value"))
      return "Please enter a valid ETH amount.";
  } else if (context === "connectWallet") {
    return "Failed to connect wallet. Please try again.";
  }
  return "";
}

/**
 * Formats a large number of shares into a more friendly format.
 * @param {BigNumber} bigNum - The big number representing shares.
 * @returns {string} - The formatted number as a string with commas.
 */
function formatSharesFriendly(bigNum) {
  const divisor = ethers.BigNumber.from("1000000000000"); // 1e12
  const friendly = bigNum.div(divisor);
  return friendly.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
