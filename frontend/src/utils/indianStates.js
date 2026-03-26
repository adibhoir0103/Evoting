// Shared Indian States & Union Territories data
// Used across: SignupPage, VotingPage, ResultsPage, AdminPanel

export const indianStates = [
    { code: 1, name: 'Andhra Pradesh' }, { code: 2, name: 'Arunachal Pradesh' },
    { code: 3, name: 'Assam' }, { code: 4, name: 'Bihar' },
    { code: 5, name: 'Chhattisgarh' }, { code: 6, name: 'Goa' },
    { code: 7, name: 'Gujarat' }, { code: 8, name: 'Haryana' },
    { code: 9, name: 'Himachal Pradesh' }, { code: 10, name: 'Jharkhand' },
    { code: 11, name: 'Karnataka' }, { code: 12, name: 'Kerala' },
    { code: 13, name: 'Madhya Pradesh' }, { code: 14, name: 'Maharashtra' },
    { code: 15, name: 'Manipur' }, { code: 16, name: 'Meghalaya' },
    { code: 17, name: 'Mizoram' }, { code: 18, name: 'Nagaland' },
    { code: 19, name: 'Odisha' }, { code: 20, name: 'Punjab' },
    { code: 21, name: 'Rajasthan' }, { code: 22, name: 'Sikkim' },
    { code: 23, name: 'Tamil Nadu' }, { code: 24, name: 'Telangana' },
    { code: 25, name: 'Tripura' }, { code: 26, name: 'Uttar Pradesh' },
    { code: 27, name: 'Uttarakhand' }, { code: 28, name: 'West Bengal' },
    { code: 29, name: 'Delhi (NCT)' }, { code: 30, name: 'Jammu & Kashmir' },
    { code: 31, name: 'Ladakh' }, { code: 32, name: 'Puducherry' },
    { code: 33, name: 'Chandigarh' }, { code: 34, name: 'Andaman & Nicobar' },
    { code: 35, name: 'Dadra & Nagar Haveli' }, { code: 36, name: 'Lakshadweep' }
];

export const getStateName = (code) =>
    (indianStates.find(s => s.code === Number(code)) || {}).name || '';
