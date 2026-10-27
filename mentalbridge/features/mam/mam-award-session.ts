// A reward read answers for the dock session that started it: a response that
// lands after the account changed must not reach the next account's record.
let session = 0

export const mamAwardSession = () => session

/** Ends the session of every read still in flight (dock listener cleanup). */
export const endMamAwardSession = () => {
  session += 1
}
