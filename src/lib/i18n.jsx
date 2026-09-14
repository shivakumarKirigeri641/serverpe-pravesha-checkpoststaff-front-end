import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/*
 * The gate app in the staff member's language.
 *
 * WHY A SWITCH ON THE PHONE, NOT A SETTING IN THE PANEL. A gate phone is shared
 * across shifts, and the person holding it this morning may read Kannada while
 * the one this evening reads English. So the choice is one tap on the screen
 * itself, remembered on that phone until somebody taps it again.
 *
 * WHAT IS NOT TRANSLATED. Number plates, pass numbers and amounts are the same
 * in both. Sentences the server writes (a date a pass was for, the reason a
 * vehicle is barred) arrive in English; where the screen has its own Kannada
 * sentence for the same verdict, that is shown first and the server's detail
 * underneath.
 */

const KEY = 'pv_gate_lang';
const readLang = () => {
  try { return localStorage.getItem(KEY) === 'kn' ? 'kn' : 'en'; } catch { return 'en'; }
};

const S = {
  en: {
    checkingShift: 'Checking your shift…',
    navCheck: 'Check', navPasses: 'Passes', navHistory: 'Earlier checks',
    langName: 'ಕನ್ನಡ', soundOn: 'Sound on', soundOff: 'Sound off',

    onDuty: 'on duty', sellPass: 'Sell a pass', endShift: 'End shift',
    expected: 'Expected', entered: 'Entered', stillToCome: 'Still to come',
    searchPh: 'Vehicle number or pass number', searchHint: 'Type the last 4 digits of the number plate.',
    matchOne: '{n} match', matchMany: '{n} matches', stillLooking: 'still looking',
    verifiedShift: 'Verified this shift', passSold: 'pass sold', entryRecorded: 'entry recorded',
    showAllChecked: 'Show all {n}', showFewerChecked: 'Show fewer', expectedToday: '{n} expected today',
    clearSearch: 'Clear',
    batteryLow: 'Battery {n}% — plug in soon. Entries stay safe on the phone even if it switches off.',
    batteryCritical: 'Battery {n}% — charge the phone now.',
    daylightAuto: 'Daylight: auto', daylightOn: 'Daylight: on', daylightOff: 'Daylight: off',
    showMoreVehicles: 'Show {n} more', showingOfTotal: 'Showing {shown} of {n} — type a number to find one',
    allowedOutside: 'allowed outside slot', inWord: 'in',
    loadingToday: 'Loading today’s passes…',
    noPassFound: 'No pass found for that number. Check the digits, or ask the visitor for their pass number.',
    allCame: 'Every booked vehicle has come through.', noEntries: 'No entries recorded yet.',
    sellForVehicle: 'Sell a pass for this vehicle', inAt: 'In at {t}',

    endQ: 'End your shift?',
    endBody: 'This gate stops recording entries until somebody signs in again with a code sent to their mobile number.',
    stay: 'No, stay on duty', yesEnd: 'Yes, end my shift', ending: 'Ending…',
    shiftSummary: 'Your shift', sinceFor: 'Since {t} · {d}', hoursMins: '{h} h {m} min', minsOnly: '{m} min',
    checked: 'Checked', refused: 'Refused', allowedAnyway: 'Allowed outside slot',
    sold: 'Passes sold', cash: 'Cash', upi: 'UPI', card: 'Card', collected: 'Collected',
    handCash: 'Cash to hand over', avgCheck: 'Average check', seconds: '{s} sec',
    summaryLoading: 'Adding up your shift…', summaryFail: 'Could not add up the shift just now. It is still saved when you end it.',
    savedForAdmin: 'This summary is saved for the office when you end the shift.',

    checkingPass: 'Checking the pass…', close: 'Close', entryRecordedTitle: 'Entry recorded',
    atTime: 'at {t}', usedAt: 'Used at {t}', pass: 'Pass', visitor: 'Visitor', date: 'Date', slot: 'Slot',
    mobile: 'Mobile', paid: 'Paid', recording: 'Recording…', allowRecord: 'Allow and record entry',
    confirmSelf: 'Vehicle checked — confirm entry', recordEntry: 'Record entry', nextVehicle: 'Next vehicle now',
    doNotAllow: 'Do not allow', letThrough: 'Let them through',

    today: 'Today', yesterday: 'Yesterday', prevDay: 'Previous day', nextDay: 'Next day',
    everyDateFound: 'every date · {n} found', passOne: '{n} pass', passMany: '{n} passes',
    passesSearchPh: 'Number plate, pass number or name', all: 'All', looking: 'Looking…',
    noMatchPlace: 'No pass at this place matches that.', nothingEnteredDay: 'Nothing has come through on this day yet.',
    noneToCome: 'No vehicles still to come on this day.', noneBooked: 'No passes booked for this day.',
    noName: 'No name', typeDeclaredGate: 'type declared at the gate', refreshing: 'Refreshing…',

    earlierChecks: 'Earlier checks', historyPh: 'Number plate or pass number',
    nothingMatchesGate: 'Nothing checked at this gate matches that.', noChecksGate: 'No checks recorded at this gate yet.',
    showEarlier: 'Show earlier checks', loadingDots: 'Loading…',
    hEntered: 'Entered', hAllowed: 'Allowed', hAlreadyUsed: 'Already used', hWrongDay: 'Wrong day',
    hOutsideSlot: 'Outside slot', hNoPass: 'No pass', hNotPaid: 'Not paid',

    entriesHere: 'Entries here', refusals: 'Refusals', passesBought: 'Passes bought', atThisGate: 'At this gate',
    neverChecked: 'Never checked here.', passesForDest: 'Passes for this destination', noPassesRecord: 'No passes on record.',
    notUsed: 'Not used',
    vEntered: 'Entered', vAllowedWarn: 'Allowed after a warning', vRefUsed: 'Refused — already used',
    vRefDay: 'Refused — wrong day', vRefSlot: 'Refused — outside the slot', vRefNoPass: 'Refused — no pass',
    vRefNotPaid: 'Refused — not paid',

    thePass: 'The pass', passNumber: 'Pass number', forWord: 'For', vehicleType: 'Vehicle type',
    typeAtGate: 'Type decided at the gate', registerCouldNot: 'The register could not identify this vehicle',
    identifiedBy: 'Identified by {k}', moved: 'Moved', movedFrom: 'from {d}',
    whoBooked: 'Who booked it', name: 'Name', notGiven: 'Not given', how: 'How', when: 'When', dayAt: '{d} at {t}',
    whatPaid: 'What was paid', total: 'Total', entryFee: 'Entry fee', serviceFeeTax: 'Service fee and tax',
    paidBy: 'Paid by', reference: 'Reference', paidAt: 'Paid at', photosSale: 'Photographs taken at the sale',
    atGate: 'At this gate', enteredWord: 'Entered', checkedBy: 'Checked by', gate: 'Gate', timesChecked: 'Times checked',
    notArrived: 'Not yet arrived.',

    phUpi: 'Payment screen', phVehicle: 'The vehicle', phPlate: 'Number plate', phOther: 'Photograph', phLoading: 'loading',
    required: '— required', sent: 'sent', removePhoto: 'Remove this photograph', sending: 'Sending…',
    takeAnother: 'Take another', takePhoto: '📷  Take a photo', tryAgain: 'Try again',
    readFail: 'This phone would not let the app read the photograph.', notPhoto: 'That file is not a photograph.',

    soldTitle: 'Pass sold', showNumber: 'Show this number to the visitor', done: 'Done', cancel: 'Cancel',
    typeDeclaredShort: 'Type declared at the gate', noPlateSuffix: ' · no number plate',
    loadingPrices: 'Loading prices and slots…', hasPlate: 'Has a number plate', noPlate: 'No number plate',
    vehicleNumber: 'Vehicle number', check: 'Check',
    trFine: 'A temporary registration (TR) is fine — type it as it is on the vehicle.',
    alreadyCame: 'Already came through today', beingPaid: 'A pass is being paid for right now',
    alreadyHas: 'This vehicle already has a pass for today', openThatPass: 'Open that pass',
    openCheckIn: 'Open it and check them in', fromRegister: 'From the vehicle register',
    whatKind: 'What kind of vehicle is it?',
    yourAnswer: 'You are looking at the vehicle — your answer sets the price, and your name goes on the pass.',
    identifies: 'Something that identifies it', requiredWord: '— required', writeWhat: 'Write what you can see',
    identityExplain: 'The register cannot vouch for this vehicle, so this is the only record of what came through. The chassis number is best — it is on the invoice and the TR paper, and it stays with the vehicle when the permanent number comes. The visitor’s mobile is taken on the next screen, and is required too.',
    vehiclePhoto: 'Photograph of the vehicle',
    vehiclePhotoHint: 'The whole vehicle from the front, close enough to read anything written on it. With no number plate this is the only record of what came through that nobody typed.',
    continueBtn: 'Continue', feeLine: '{label} · entry ₹{e} + fee ₹{f}', declaredByYou: ' · type declared by you',
    fromRegisterSuffix: ' · from the register', identifiedByShort: 'Identified by',
    noSlotNow: 'No slot can be entered now. Entry closes an hour before a slot ends.',
    placesLeft: '{n} places left', full: 'Full', lastEntry: 'last entry {t}',
    visitorMobile: 'Visitor mobile', digits10: '10 digits', optional: 'Optional',
    upiRef: 'UPI reference', cardSlip: 'Card slip number',
    upiPhoto: 'Photograph of the payment screen', cardPhoto: 'Photograph of the card slip',
    upiPhotoHint: 'Worth taking. A reference typed from somebody else’s screen is easy to get wrong, and this is what settles it if the payment cannot be found later.',
    cardPhotoHint: 'Worth taking, so the slip number can be checked against the settlement later.',
    vehicleHere: 'The vehicle is here — record its entry now', slotFull: 'That slot is full for this vehicle type.',
    goBackPhoto: 'Go back and photograph the vehicle. With no number plate, a pass cannot be issued without it.',
    back: 'Back', selling: 'Selling…', takeAndIssue: 'Take ₹{a} and issue',

    appTitle: 'Pravesha Checkpost', signInSub: 'Sign in to start your shift.', whichCheckpost: 'Which checkpost are you at?',
    mobileNumber: 'Mobile number', mobilePh: '10-digit number', onlyAdded: 'Only numbers your administrator has added can sign in.',
    codeLabel: '4-digit code', sentTo: 'Sent by SMS to ••••{d}. Valid for 3 minutes.', waitS: 'Wait {s}s', getOtp: 'Get OTP',
    checkingDots: 'Checking…', startShift: 'Start shift', sendAnotherIn: 'Send another code in {s}s', sendAnother: 'Send another code',
    product: 'Pravesha — a product of ServerPe App Solutions', shiftEnded: 'Your shift has ended. Please sign in again.',

    offlineTitle: 'No signal — working offline',
    offlineBody: 'Checking from the list saved at {t}. Entries are kept on this phone and sent when the signal returns.',
    offlineNoList: 'No signal, and no list saved on this phone yet. Connect once to download today’s passes.',
    waitingToSend: '{n} waiting to send', sendingNow: 'Sending {n} saved…', sendNow: 'Send now',
    problemTitle: 'Sent later, but not accepted', problemHint: 'This vehicle was let in without signal. Tell the office.',
    dismiss: 'OK', offlineCheck: 'Checked on this phone — no signal',
    savedOffline: 'Saved on this phone — sent when the signal returns', offlineNoPass: 'No signal, and this pass is not in the list saved on this phone.',
    savedOfflineShort: 'saved offline', sellNeedsSignal: 'Selling a pass needs signal.',

    watchCheckTitle: 'Check this vehicle carefully', watchReason: 'The office says: {r}', watchChip: 'Watchlist',
    watchBlockedChip: 'Blocked',

    otherTabOne: '1 more match is under {tab}.',
    otherTabMany: '{n} more matches are under {tab}.',
    showThem: 'Show them',
  },
  kn: {
    checkingShift: 'ನಿಮ್ಮ ಶಿಫ್ಟ್ ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…',
    navCheck: 'ಪರಿಶೀಲನೆ', navPasses: 'ಪಾಸ್‌ಗಳು', navHistory: 'ಹಿಂದಿನ ಪರಿಶೀಲನೆ',
    langName: 'English', soundOn: 'ಧ್ವನಿ ಆನ್', soundOff: 'ಧ್ವನಿ ಆಫ್',

    onDuty: 'ಕರ್ತವ್ಯದಲ್ಲಿ', sellPass: 'ಪಾಸ್ ಮಾರಾಟ', endShift: 'ಶಿಫ್ಟ್ ಮುಗಿಸಿ',
    expected: 'ನಿರೀಕ್ಷಿತ', entered: 'ಪ್ರವೇಶಿಸಿದವು', stillToCome: 'ಬರಬೇಕಾದವು',
    searchPh: 'ವಾಹನ ಸಂಖ್ಯೆ ಅಥವಾ ಪಾಸ್ ಸಂಖ್ಯೆ', searchHint: 'ನಂಬರ್ ಪ್ಲೇಟ್‌ನ ಕೊನೆಯ 4 ಅಂಕಿಗಳನ್ನು ಟೈಪ್ ಮಾಡಿ.',
    matchOne: '{n} ಹೊಂದಾಣಿಕೆ', matchMany: '{n} ಹೊಂದಾಣಿಕೆಗಳು', stillLooking: 'ಇನ್ನೂ ಹುಡುಕಲಾಗುತ್ತಿದೆ',
    verifiedShift: 'ಈ ಶಿಫ್ಟ್‌ನಲ್ಲಿ ಪರಿಶೀಲಿಸಿದವು', passSold: 'ಪಾಸ್ ಮಾರಾಟ', entryRecorded: 'ಪ್ರವೇಶ ದಾಖಲಾಗಿದೆ',
    showAllChecked: 'ಎಲ್ಲಾ {n} ತೋರಿಸಿ', showFewerChecked: 'ಕಡಿಮೆ ತೋರಿಸಿ', expectedToday: 'ಇಂದು {n} ನಿರೀಕ್ಷಿತ',
    clearSearch: 'ಅಳಿಸಿ',
    batteryLow: 'ಬ್ಯಾಟರಿ {n}% — ಬೇಗ ಚಾರ್ಜ್ ಮಾಡಿ. ಫೋನ್ ಆಫ್ ಆದರೂ ಪ್ರವೇಶಗಳು ಫೋನ್‌ನಲ್ಲಿ ಸುರಕ್ಷಿತ.',
    batteryCritical: 'ಬ್ಯಾಟರಿ {n}% — ಈಗಲೇ ಚಾರ್ಜ್ ಮಾಡಿ.',
    daylightAuto: 'ಹಗಲು ಮೋಡ್: ಸ್ವಯಂ', daylightOn: 'ಹಗಲು ಮೋಡ್: ಆನ್', daylightOff: 'ಹಗಲು ಮೋಡ್: ಆಫ್',
    showMoreVehicles: 'ಇನ್ನೂ {n} ತೋರಿಸಿ', showingOfTotal: '{n} ರಲ್ಲಿ {shown} ತೋರಿಸಲಾಗಿದೆ — ಹುಡುಕಲು ಸಂಖ್ಯೆ ಟೈಪ್ ಮಾಡಿ',
    allowedOutside: 'ಸ್ಲಾಟ್ ಹೊರಗೆ ಅನುಮತಿಸಲಾಗಿದೆ', inWord: 'ಒಳಗೆ',
    loadingToday: 'ಇಂದಿನ ಪಾಸ್‌ಗಳನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ…',
    noPassFound: 'ಆ ಸಂಖ್ಯೆಗೆ ಪಾಸ್ ಸಿಗಲಿಲ್ಲ. ಅಂಕಿಗಳನ್ನು ಪರಿಶೀಲಿಸಿ, ಅಥವಾ ಪ್ರವಾಸಿಗರ ಪಾಸ್ ಸಂಖ್ಯೆ ಕೇಳಿ.',
    allCame: 'ಬುಕ್ ಮಾಡಿದ ಎಲ್ಲಾ ವಾಹನಗಳು ಬಂದಿವೆ.', noEntries: 'ಇನ್ನೂ ಯಾವುದೇ ಪ್ರವೇಶ ದಾಖಲಾಗಿಲ್ಲ.',
    sellForVehicle: 'ಈ ವಾಹನಕ್ಕೆ ಪಾಸ್ ಮಾರಾಟ ಮಾಡಿ', inAt: 'ಒಳಗೆ {t}',

    endQ: 'ನಿಮ್ಮ ಶಿಫ್ಟ್ ಮುಗಿಸಬೇಕೆ?',
    endBody: 'ಯಾರಾದರೂ ತಮ್ಮ ಮೊಬೈಲ್‌ಗೆ ಬಂದ ಕೋಡ್‌ನೊಂದಿಗೆ ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡುವವರೆಗೆ ಈ ಗೇಟ್ ಪ್ರವೇಶಗಳನ್ನು ದಾಖಲಿಸುವುದಿಲ್ಲ.',
    stay: 'ಇಲ್ಲ, ಕರ್ತವ್ಯದಲ್ಲಿರುತ್ತೇನೆ', yesEnd: 'ಹೌದು, ಶಿಫ್ಟ್ ಮುಗಿಸಿ', ending: 'ಮುಗಿಸಲಾಗುತ್ತಿದೆ…',
    shiftSummary: 'ನಿಮ್ಮ ಶಿಫ್ಟ್', sinceFor: '{t} ರಿಂದ · {d}', hoursMins: '{h} ಗಂ {m} ನಿ', minsOnly: '{m} ನಿ',
    checked: 'ಪರಿಶೀಲಿಸಿದವು', refused: 'ನಿರಾಕರಿಸಿದವು', allowedAnyway: 'ಸ್ಲಾಟ್ ಹೊರಗೆ ಅನುಮತಿ',
    sold: 'ಮಾರಾಟವಾದ ಪಾಸ್', cash: 'ನಗದು', upi: 'UPI', card: 'ಕಾರ್ಡ್', collected: 'ಒಟ್ಟು ಸಂಗ್ರಹ',
    handCash: 'ಹಸ್ತಾಂತರಿಸಬೇಕಾದ ನಗದು', avgCheck: 'ಸರಾಸರಿ ಪರಿಶೀಲನೆ', seconds: '{s} ಸೆ',
    summaryLoading: 'ನಿಮ್ಮ ಶಿಫ್ಟ್ ಲೆಕ್ಕ ಹಾಕಲಾಗುತ್ತಿದೆ…', summaryFail: 'ಈಗ ಶಿಫ್ಟ್ ಲೆಕ್ಕ ಹಾಕಲಾಗಲಿಲ್ಲ. ಶಿಫ್ಟ್ ಮುಗಿಸಿದಾಗ ಅದು ಉಳಿಸಲಾಗುತ್ತದೆ.',
    savedForAdmin: 'ಶಿಫ್ಟ್ ಮುಗಿಸಿದಾಗ ಈ ಸಾರಾಂಶ ಕಚೇರಿಗಾಗಿ ಉಳಿಸಲಾಗುತ್ತದೆ.',

    checkingPass: 'ಪಾಸ್ ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…', close: 'ಮುಚ್ಚಿ', entryRecordedTitle: 'ಪ್ರವೇಶ ದಾಖಲಾಗಿದೆ',
    atTime: 'ಸಮಯ {t}', usedAt: 'ಬಳಸಿದ ಸಮಯ {t}', pass: 'ಪಾಸ್', visitor: 'ಪ್ರವಾಸಿಗರು', date: 'ದಿನಾಂಕ', slot: 'ಸ್ಲಾಟ್',
    mobile: 'ಮೊಬೈಲ್', paid: 'ಪಾವತಿ', recording: 'ದಾಖಲಿಸಲಾಗುತ್ತಿದೆ…', allowRecord: 'ಅನುಮತಿಸಿ ಪ್ರವೇಶ ದಾಖಲಿಸಿ',
    confirmSelf: 'ವಾಹನ ಪರಿಶೀಲಿಸಲಾಗಿದೆ — ಪ್ರವೇಶ ದೃಢೀಕರಿಸಿ', recordEntry: 'ಪ್ರವೇಶ ದಾಖಲಿಸಿ', nextVehicle: 'ಮುಂದಿನ ವಾಹನ',
    doNotAllow: 'ಅನುಮತಿಸಬೇಡಿ', letThrough: 'ಒಳಗೆ ಬಿಡಿ',

    today: 'ಇಂದು', yesterday: 'ನಿನ್ನೆ', prevDay: 'ಹಿಂದಿನ ದಿನ', nextDay: 'ಮುಂದಿನ ದಿನ',
    everyDateFound: 'ಎಲ್ಲಾ ದಿನಾಂಕಗಳು · {n} ಸಿಕ್ಕಿವೆ', passOne: '{n} ಪಾಸ್', passMany: '{n} ಪಾಸ್‌ಗಳು',
    passesSearchPh: 'ನಂಬರ್ ಪ್ಲೇಟ್, ಪಾಸ್ ಸಂಖ್ಯೆ ಅಥವಾ ಹೆಸರು', all: 'ಎಲ್ಲಾ', looking: 'ಹುಡುಕಲಾಗುತ್ತಿದೆ…',
    noMatchPlace: 'ಈ ತಾಣದಲ್ಲಿ ಹೊಂದಾಣಿಕೆಯ ಪಾಸ್ ಇಲ್ಲ.', nothingEnteredDay: 'ಈ ದಿನ ಇನ್ನೂ ಯಾರೂ ಪ್ರವೇಶಿಸಿಲ್ಲ.',
    noneToCome: 'ಈ ದಿನ ಬರಬೇಕಾದ ವಾಹನಗಳಿಲ್ಲ.', noneBooked: 'ಈ ದಿನಕ್ಕೆ ಯಾವುದೇ ಪಾಸ್ ಬುಕ್ ಆಗಿಲ್ಲ.',
    noName: 'ಹೆಸರಿಲ್ಲ', typeDeclaredGate: 'ಗೇಟ್‌ನಲ್ಲಿ ಪ್ರಕಾರ ಘೋಷಿಸಲಾಗಿದೆ', refreshing: 'ರಿಫ್ರೆಶ್ ಆಗುತ್ತಿದೆ…',

    earlierChecks: 'ಹಿಂದಿನ ಪರಿಶೀಲನೆಗಳು', historyPh: 'ನಂಬರ್ ಪ್ಲೇಟ್ ಅಥವಾ ಪಾಸ್ ಸಂಖ್ಯೆ',
    nothingMatchesGate: 'ಈ ಗೇಟ್‌ನಲ್ಲಿ ಹೊಂದಾಣಿಕೆಯ ಪರಿಶೀಲನೆ ಇಲ್ಲ.', noChecksGate: 'ಈ ಗೇಟ್‌ನಲ್ಲಿ ಇನ್ನೂ ಪರಿಶೀಲನೆ ದಾಖಲಾಗಿಲ್ಲ.',
    showEarlier: 'ಹಿಂದಿನ ಪರಿಶೀಲನೆಗಳನ್ನು ತೋರಿಸಿ', loadingDots: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ…',
    hEntered: 'ಪ್ರವೇಶ', hAllowed: 'ಅನುಮತಿಸಲಾಗಿದೆ', hAlreadyUsed: 'ಈಗಾಗಲೇ ಬಳಸಲಾಗಿದೆ', hWrongDay: 'ತಪ್ಪು ದಿನ',
    hOutsideSlot: 'ಸ್ಲಾಟ್ ಹೊರಗೆ', hNoPass: 'ಪಾಸ್ ಇಲ್ಲ', hNotPaid: 'ಪಾವತಿಯಾಗಿಲ್ಲ',

    entriesHere: 'ಇಲ್ಲಿ ಪ್ರವೇಶ', refusals: 'ನಿರಾಕರಣೆ', passesBought: 'ಖರೀದಿಸಿದ ಪಾಸ್', atThisGate: 'ಈ ಗೇಟ್‌ನಲ್ಲಿ',
    neverChecked: 'ಇಲ್ಲಿ ಎಂದೂ ಪರಿಶೀಲಿಸಿಲ್ಲ.', passesForDest: 'ಈ ತಾಣದ ಪಾಸ್‌ಗಳು', noPassesRecord: 'ಯಾವುದೇ ಪಾಸ್ ದಾಖಲೆ ಇಲ್ಲ.',
    notUsed: 'ಬಳಸಿಲ್ಲ',
    vEntered: 'ಪ್ರವೇಶಿಸಿದೆ', vAllowedWarn: 'ಎಚ್ಚರಿಕೆಯ ನಂತರ ಅನುಮತಿಸಲಾಗಿದೆ', vRefUsed: 'ನಿರಾಕರಿಸಲಾಗಿದೆ — ಈಗಾಗಲೇ ಬಳಸಲಾಗಿದೆ',
    vRefDay: 'ನಿರಾಕರಿಸಲಾಗಿದೆ — ತಪ್ಪು ದಿನ', vRefSlot: 'ನಿರಾಕರಿಸಲಾಗಿದೆ — ಸ್ಲಾಟ್ ಹೊರಗೆ', vRefNoPass: 'ನಿರಾಕರಿಸಲಾಗಿದೆ — ಪಾಸ್ ಇಲ್ಲ',
    vRefNotPaid: 'ನಿರಾಕರಿಸಲಾಗಿದೆ — ಪಾವತಿಯಾಗಿಲ್ಲ',

    thePass: 'ಪಾಸ್', passNumber: 'ಪಾಸ್ ಸಂಖ್ಯೆ', forWord: 'ದಿನ ಮತ್ತು ಸ್ಲಾಟ್', vehicleType: 'ವಾಹನದ ಪ್ರಕಾರ',
    typeAtGate: 'ಗೇಟ್‌ನಲ್ಲಿ ನಿರ್ಧರಿಸಿದ ಪ್ರಕಾರ', registerCouldNot: 'ರಿಜಿಸ್ಟರ್ ಈ ವಾಹನವನ್ನು ಗುರುತಿಸಲಿಲ್ಲ',
    identifiedBy: 'ಗುರುತು: {k}', moved: 'ಬದಲಾಯಿಸಲಾಗಿದೆ', movedFrom: '{d} ರಿಂದ',
    whoBooked: 'ಯಾರು ಬುಕ್ ಮಾಡಿದರು', name: 'ಹೆಸರು', notGiven: 'ನೀಡಿಲ್ಲ', how: 'ಹೇಗೆ', when: 'ಯಾವಾಗ', dayAt: '{d}, {t}',
    whatPaid: 'ಪಾವತಿ ವಿವರ', total: 'ಒಟ್ಟು', entryFee: 'ಪ್ರವೇಶ ಶುಲ್ಕ', serviceFeeTax: 'ಸೇವಾ ಶುಲ್ಕ ಮತ್ತು ತೆರಿಗೆ',
    paidBy: 'ಪಾವತಿ ವಿಧಾನ', reference: 'ಉಲ್ಲೇಖ', paidAt: 'ಪಾವತಿ ಸಮಯ', photosSale: 'ಮಾರಾಟದ ಸಮಯದ ಫೋಟೋಗಳು',
    atGate: 'ಈ ಗೇಟ್‌ನಲ್ಲಿ', enteredWord: 'ಪ್ರವೇಶ', checkedBy: 'ಪರಿಶೀಲಿಸಿದವರು', gate: 'ಗೇಟ್', timesChecked: 'ಪರಿಶೀಲಿಸಿದ ಬಾರಿ',
    notArrived: 'ಇನ್ನೂ ಬಂದಿಲ್ಲ.',

    phUpi: 'ಪಾವತಿ ಪರದೆ', phVehicle: 'ವಾಹನ', phPlate: 'ನಂಬರ್ ಪ್ಲೇಟ್', phOther: 'ಫೋಟೋ', phLoading: 'ಲೋಡ್',
    required: '— ಅಗತ್ಯ', sent: 'ಕಳುಹಿಸಲಾಗಿದೆ', removePhoto: 'ಈ ಫೋಟೋ ತೆಗೆದುಹಾಕಿ', sending: 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…',
    takeAnother: 'ಇನ್ನೊಂದು ತೆಗೆಯಿರಿ', takePhoto: '📷  ಫೋಟೋ ತೆಗೆಯಿರಿ', tryAgain: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
    readFail: 'ಈ ಫೋನ್ ಫೋಟೋ ಓದಲು ಬಿಡಲಿಲ್ಲ.', notPhoto: 'ಅದು ಫೋಟೋ ಅಲ್ಲ.',

    soldTitle: 'ಪಾಸ್ ಮಾರಾಟವಾಗಿದೆ', showNumber: 'ಈ ಸಂಖ್ಯೆಯನ್ನು ಪ್ರವಾಸಿಗರಿಗೆ ತೋರಿಸಿ', done: 'ಮುಗಿಯಿತು', cancel: 'ರದ್ದುಮಾಡಿ',
    typeDeclaredShort: 'ಗೇಟ್‌ನಲ್ಲಿ ಪ್ರಕಾರ ಘೋಷಿಸಲಾಗಿದೆ', noPlateSuffix: ' · ನಂಬರ್ ಪ್ಲೇಟ್ ಇಲ್ಲ',
    loadingPrices: 'ಬೆಲೆಗಳು ಮತ್ತು ಸ್ಲಾಟ್‌ಗಳು ಲೋಡ್ ಆಗುತ್ತಿವೆ…', hasPlate: 'ನಂಬರ್ ಪ್ಲೇಟ್ ಇದೆ', noPlate: 'ನಂಬರ್ ಪ್ಲೇಟ್ ಇಲ್ಲ',
    vehicleNumber: 'ವಾಹನ ಸಂಖ್ಯೆ', check: 'ಪರಿಶೀಲಿಸಿ',
    trFine: 'ತಾತ್ಕಾಲಿಕ ನೋಂದಣಿ (TR) ಆದರೂ ಸರಿ — ವಾಹನದ ಮೇಲೆ ಇರುವಂತೆಯೇ ಟೈಪ್ ಮಾಡಿ.',
    alreadyCame: 'ಇಂದು ಈಗಾಗಲೇ ಬಂದಿದೆ', beingPaid: 'ಈಗ ಒಂದು ಪಾಸ್‌ಗೆ ಪಾವತಿ ನಡೆಯುತ್ತಿದೆ',
    alreadyHas: 'ಈ ವಾಹನಕ್ಕೆ ಇಂದಿಗೆ ಈಗಾಗಲೇ ಪಾಸ್ ಇದೆ', openThatPass: 'ಆ ಪಾಸ್ ತೆರೆಯಿರಿ',
    openCheckIn: 'ತೆರೆದು ಚೆಕ್-ಇನ್ ಮಾಡಿ', fromRegister: 'ವಾಹನ ರಿಜಿಸ್ಟರ್‌ನಿಂದ',
    whatKind: 'ಇದು ಯಾವ ರೀತಿಯ ವಾಹನ?',
    yourAnswer: 'ನೀವು ವಾಹನವನ್ನು ನೋಡುತ್ತಿದ್ದೀರಿ — ನಿಮ್ಮ ಉತ್ತರ ಬೆಲೆ ನಿರ್ಧರಿಸುತ್ತದೆ, ಪಾಸ್‌ನಲ್ಲಿ ನಿಮ್ಮ ಹೆಸರು ಇರುತ್ತದೆ.',
    identifies: 'ಇದನ್ನು ಗುರುತಿಸುವ ಏನಾದರೂ', requiredWord: '— ಅಗತ್ಯ', writeWhat: 'ನೀವು ನೋಡುವುದನ್ನು ಬರೆಯಿರಿ',
    identityExplain: 'ರಿಜಿಸ್ಟರ್ ಈ ವಾಹನವನ್ನು ಖಚಿತಪಡಿಸಲಾರದು, ಆದ್ದರಿಂದ ಬಂದದ್ದರ ದಾಖಲೆ ಇದೊಂದೇ. ಚಾಸಿಸ್ ಸಂಖ್ಯೆ ಉತ್ತಮ — ಇನ್‌ವಾಯ್ಸ್ ಮತ್ತು TR ಕಾಗದದಲ್ಲಿ ಇರುತ್ತದೆ, ಶಾಶ್ವತ ಸಂಖ್ಯೆ ಬಂದಾಗಲೂ ವಾಹನದೊಂದಿಗೇ ಇರುತ್ತದೆ. ಪ್ರವಾಸಿಗರ ಮೊಬೈಲ್ ಮುಂದಿನ ಪರದೆಯಲ್ಲಿ ಪಡೆಯಲಾಗುತ್ತದೆ, ಅದೂ ಅಗತ್ಯ.',
    vehiclePhoto: 'ವಾಹನದ ಫೋಟೋ',
    vehiclePhotoHint: 'ಮುಂಭಾಗದಿಂದ ಇಡೀ ವಾಹನ, ಅದರ ಮೇಲೆ ಬರೆದದ್ದು ಓದುವಷ್ಟು ಹತ್ತಿರದಿಂದ. ನಂಬರ್ ಪ್ಲೇಟ್ ಇಲ್ಲದಿದ್ದಾಗ ಯಾರೂ ಟೈಪ್ ಮಾಡದ ಏಕೈಕ ದಾಖಲೆ ಇದೇ.',
    continueBtn: 'ಮುಂದುವರಿಯಿರಿ', feeLine: '{label} · ಪ್ರವೇಶ ₹{e} + ಶುಲ್ಕ ₹{f}', declaredByYou: ' · ನೀವು ಘೋಷಿಸಿದ ಪ್ರಕಾರ',
    fromRegisterSuffix: ' · ರಿಜಿಸ್ಟರ್‌ನಿಂದ', identifiedByShort: 'ಗುರುತು',
    noSlotNow: 'ಈಗ ಯಾವ ಸ್ಲಾಟ್‌ಗೂ ಪ್ರವೇಶ ಸಾಧ್ಯವಿಲ್ಲ. ಸ್ಲಾಟ್ ಮುಗಿಯುವ ಒಂದು ಗಂಟೆ ಮೊದಲು ಪ್ರವೇಶ ಮುಚ್ಚುತ್ತದೆ.',
    placesLeft: '{n} ಸ್ಥಾನ ಬಾಕಿ', full: 'ಭರ್ತಿ', lastEntry: 'ಕೊನೆಯ ಪ್ರವೇಶ {t}',
    visitorMobile: 'ಪ್ರವಾಸಿಗರ ಮೊಬೈಲ್', digits10: '10 ಅಂಕಿ', optional: 'ಐಚ್ಛಿಕ',
    upiRef: 'UPI ಉಲ್ಲೇಖ ಸಂಖ್ಯೆ', cardSlip: 'ಕಾರ್ಡ್ ಸ್ಲಿಪ್ ಸಂಖ್ಯೆ',
    upiPhoto: 'ಪಾವತಿ ಪರದೆಯ ಫೋಟೋ', cardPhoto: 'ಕಾರ್ಡ್ ಸ್ಲಿಪ್‌ನ ಫೋಟೋ',
    upiPhotoHint: 'ತೆಗೆಯುವುದು ಒಳ್ಳೆಯದು. ಬೇರೆಯವರ ಪರದೆಯಿಂದ ಟೈಪ್ ಮಾಡಿದ ಉಲ್ಲೇಖ ತಪ್ಪಾಗಬಹುದು; ನಂತರ ಪಾವತಿ ಸಿಗದಿದ್ದರೆ ಇದೇ ಸಾಕ್ಷಿ.',
    cardPhotoHint: 'ತೆಗೆಯುವುದು ಒಳ್ಳೆಯದು, ನಂತರ ಸ್ಲಿಪ್ ಸಂಖ್ಯೆಯನ್ನು ಸೆಟಲ್‌ಮೆಂಟ್‌ನೊಂದಿಗೆ ಹೋಲಿಸಬಹುದು.',
    vehicleHere: 'ವಾಹನ ಇಲ್ಲಿದೆ — ಈಗಲೇ ಪ್ರವೇಶ ದಾಖಲಿಸಿ', slotFull: 'ಈ ವಾಹನ ಪ್ರಕಾರಕ್ಕೆ ಆ ಸ್ಲಾಟ್ ಭರ್ತಿಯಾಗಿದೆ.',
    goBackPhoto: 'ಹಿಂದೆ ಹೋಗಿ ವಾಹನದ ಫೋಟೋ ತೆಗೆಯಿರಿ. ನಂಬರ್ ಪ್ಲೇಟ್ ಇಲ್ಲದಿದ್ದರೆ ಅದಿಲ್ಲದೆ ಪಾಸ್ ನೀಡಲಾಗದು.',
    back: 'ಹಿಂದೆ', selling: 'ಮಾರಾಟವಾಗುತ್ತಿದೆ…', takeAndIssue: '₹{a} ಪಡೆದು ಪಾಸ್ ನೀಡಿ',

    appTitle: 'ಪ್ರವೇಶ ಚೆಕ್‌ಪೋಸ್ಟ್', signInSub: 'ನಿಮ್ಮ ಶಿಫ್ಟ್ ಆರಂಭಿಸಲು ಸೈನ್ ಇನ್ ಮಾಡಿ.', whichCheckpost: 'ನೀವು ಯಾವ ಚೆಕ್‌ಪೋಸ್ಟ್‌ನಲ್ಲಿದ್ದೀರಿ?',
    mobileNumber: 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ', mobilePh: '10 ಅಂಕಿಯ ಸಂಖ್ಯೆ', onlyAdded: 'ನಿರ್ವಾಹಕರು ಸೇರಿಸಿದ ಸಂಖ್ಯೆಗಳಿಗೆ ಮಾತ್ರ ಪ್ರವೇಶ.',
    codeLabel: '4 ಅಂಕಿಯ ಕೋಡ್', sentTo: '••••{d} ಗೆ SMS ಕಳುಹಿಸಲಾಗಿದೆ. 3 ನಿಮಿಷ ಮಾನ್ಯ.', waitS: '{s} ಸೆ ಕಾಯಿರಿ', getOtp: 'OTP ಪಡೆಯಿರಿ',
    checkingDots: 'ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…', startShift: 'ಶಿಫ್ಟ್ ಆರಂಭಿಸಿ', sendAnotherIn: '{s} ಸೆ ನಂತರ ಇನ್ನೊಂದು ಕೋಡ್', sendAnother: 'ಇನ್ನೊಂದು ಕೋಡ್ ಕಳುಹಿಸಿ',
    product: 'ಪ್ರವೇಶ — ServerPe App Solutions ಉತ್ಪನ್ನ', shiftEnded: 'ನಿಮ್ಮ ಶಿಫ್ಟ್ ಮುಗಿದಿದೆ. ದಯವಿಟ್ಟು ಮತ್ತೆ ಸೈನ್ ಇನ್ ಮಾಡಿ.',

    offlineTitle: 'ಸಿಗ್ನಲ್ ಇಲ್ಲ — ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿ ಕೆಲಸ ಮಾಡುತ್ತಿದೆ',
    offlineBody: '{t} ಕ್ಕೆ ಉಳಿಸಿದ ಪಟ್ಟಿಯಿಂದ ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ. ಪ್ರವೇಶಗಳು ಈ ಫೋನ್‌ನಲ್ಲಿ ಉಳಿಯುತ್ತವೆ, ಸಿಗ್ನಲ್ ಬಂದಾಗ ಕಳುಹಿಸಲಾಗುತ್ತದೆ.',
    offlineNoList: 'ಸಿಗ್ನಲ್ ಇಲ್ಲ, ಈ ಫೋನ್‌ನಲ್ಲಿ ಇನ್ನೂ ಪಟ್ಟಿ ಉಳಿಸಿಲ್ಲ. ಇಂದಿನ ಪಾಸ್‌ಗಳನ್ನು ಪಡೆಯಲು ಒಮ್ಮೆ ಸಂಪರ್ಕಿಸಿ.',
    waitingToSend: '{n} ಕಳುಹಿಸಲು ಬಾಕಿ', sendingNow: 'ಉಳಿಸಿದ {n} ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…', sendNow: 'ಈಗ ಕಳುಹಿಸಿ',
    problemTitle: 'ನಂತರ ಕಳುಹಿಸಲಾಗಿದೆ, ಆದರೆ ಸ್ವೀಕರಿಸಲಾಗಿಲ್ಲ', problemHint: 'ಈ ವಾಹನವನ್ನು ಸಿಗ್ನಲ್ ಇಲ್ಲದಾಗ ಒಳಗೆ ಬಿಡಲಾಗಿದೆ. ಕಚೇರಿಗೆ ತಿಳಿಸಿ.',
    dismiss: 'ಸರಿ', offlineCheck: 'ಈ ಫೋನ್‌ನಲ್ಲಿ ಪರಿಶೀಲಿಸಲಾಗಿದೆ — ಸಿಗ್ನಲ್ ಇಲ್ಲ',
    savedOffline: 'ಈ ಫೋನ್‌ನಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ — ಸಿಗ್ನಲ್ ಬಂದಾಗ ಕಳುಹಿಸಲಾಗುತ್ತದೆ', offlineNoPass: 'ಸಿಗ್ನಲ್ ಇಲ್ಲ, ಈ ಪಾಸ್ ಫೋನ್‌ನಲ್ಲಿ ಉಳಿಸಿದ ಪಟ್ಟಿಯಲ್ಲಿಲ್ಲ.',
    savedOfflineShort: 'ಆಫ್‌ಲೈನ್ ಉಳಿಸಲಾಗಿದೆ', sellNeedsSignal: 'ಪಾಸ್ ಮಾರಾಟಕ್ಕೆ ಸಿಗ್ನಲ್ ಬೇಕು.',

    watchCheckTitle: 'ಈ ವಾಹನವನ್ನು ಎಚ್ಚರಿಕೆಯಿಂದ ಪರಿಶೀಲಿಸಿ', watchReason: 'ಕಚೇರಿ ಹೇಳಿದ ಕಾರಣ: {r}', watchChip: 'ನಿಗಾ ಪಟ್ಟಿ',
    watchBlockedChip: 'ನಿರ್ಬಂಧಿತ',

    otherTabOne: '"{tab}" ನಲ್ಲಿ ಇನ್ನೂ 1 ಹೊಂದಾಣಿಕೆ ಇದೆ.',
    otherTabMany: '"{tab}" ನಲ್ಲಿ ಇನ್ನೂ {n} ಹೊಂದಾಣಿಕೆಗಳಿವೆ.',
    showThem: 'ತೋರಿಸಿ',
  },
};

const Ctx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(readLang);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((next) => {
    const value = next === 'kn' ? 'kn' : 'en';
    try { localStorage.setItem(KEY, value); } catch { /* private mode */ }
    setLangState(value);
  }, []);

  const t = useCallback((key, vars) => {
    const s = (S[lang] && S[lang][key]) ?? S.en[key] ?? key;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k]))) : s;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t, locale: lang === 'kn' ? 'kn-IN' : 'en-IN' }), [lang, setLang, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);

/** One tap to the other language, labelled in that language so it can be found. */
export function LangToggle({ className = '' }) {
  const { lang, setLang, t } = useT();
  return (
    <button type="button" onClick={() => setLang(lang === 'kn' ? 'en' : 'kn')}
      className={`rounded-lg px-3 py-1.5 text-[13px] font-bold ${className}`}
      aria-label={lang === 'kn' ? 'Switch to English' : 'ಕನ್ನಡಕ್ಕೆ ಬದಲಿಸಿ'}>
      {t('langName')}
    </button>
  );
}
