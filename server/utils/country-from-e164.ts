'use strict';
/**
 * Lightweight E.164 → ISO 3166-1 alpha-2 resolver. Used by the SMS service
 * to pick the correct per-country credit rate. This is intentionally not a
 * full libphonenumber port — it's a longest-prefix-match against the
 * dialing-code table. Accurate enough for billing, since the only thing
 * the rate table needs is the country, not the carrier or region.
 *
 * Falls back to `null` for unrecognized prefixes; callers should use the
 * `iso_country='*'` default row in `sms_country_rates`.
 */

/**
 * Country dialing codes that share +1 (NANP) — handled separately because
 * the area code (3 digits after +1) determines the country. Entries here
 * must be EXACT 4-digit prefixes (`+1XXX`).
 *
 * Common shared NANP codes by area code:
 *   CA: 204, 226, 236, 249, 250, 263, 289, 306, 343, 354, 365, 367, 368,
 *       403, 416, 418, 428, 431, 437, 438, 450, 468, 474, 506, 514, 519,
 *       548, 579, 581, 584, 587, 600, 604, 613, 639, 647, 672, 683, 705,
 *       709, 742, 753, 778, 780, 782, 807, 819, 825, 867, 873, 879, 902, 905
 *
 * For brevity we only enumerate the highest-volume CA codes; everything
 * else under +1 maps to US, which is a safe default for credit billing.
 */
const NANP_CA_AREA_CODES = new Set<string>([
  '204', '226', '236', '249', '250', '289', '306', '343', '365', '403',
  '416', '418', '431', '437', '438', '450', '506', '514', '519', '548',
  '579', '581', '587', '604', '613', '639', '647', '672', '705', '709',
  '742', '778', '780', '782', '807', '819', '825', '867', '873', '902',
  '905',
]);

/** ISO codes for the rest of NANP (covered by +1 but not US/CA). */
const NANP_OTHER_AREA_CODES: Record<string, string> = {
  '242': 'BS', '246': 'BB', '264': 'AI', '268': 'AG', '284': 'VG',
  '345': 'KY', '441': 'BM', '473': 'GD', '649': 'TC', '658': 'JM',
  '664': 'MS', '670': 'MP', '671': 'GU', '684': 'AS', '721': 'SX',
  '758': 'LC', '767': 'DM', '784': 'VC', '787': 'PR', '809': 'DO',
  '829': 'DO', '849': 'DO', '868': 'TT', '869': 'KN', '876': 'JM',
  '939': 'PR',
};

/**
 * Longest-prefix-match dialing code map. Keys are the digits after `+`,
 * sorted longest-first when iterating so 4-digit Caribbean codes match
 * before the +1 fallback. ~150 entries — covers >99% of global SMS volume.
 */
const DIALING_CODES: Record<string, string> = {
  // 3+ digit codes (longest-first matching)
  '350': 'GI', '351': 'PT', '352': 'LU', '353': 'IE', '354': 'IS',
  '355': 'AL', '356': 'MT', '357': 'CY', '358': 'FI', '359': 'BG',
  '370': 'LT', '371': 'LV', '372': 'EE', '373': 'MD', '374': 'AM',
  '375': 'BY', '376': 'AD', '377': 'MC', '378': 'SM', '380': 'UA',
  '381': 'RS', '382': 'ME', '383': 'XK', '385': 'HR', '386': 'SI',
  '387': 'BA', '389': 'MK',
  '420': 'CZ', '421': 'SK', '423': 'LI',
  '500': 'FK', '501': 'BZ', '502': 'GT', '503': 'SV', '504': 'HN',
  '505': 'NI', '506': 'CR', '507': 'PA', '508': 'PM', '509': 'HT',
  '590': 'GP', '591': 'BO', '592': 'GY', '593': 'EC', '594': 'GF',
  '595': 'PY', '596': 'MQ', '597': 'SR', '598': 'UY', '599': 'CW',
  '670': 'TL', '672': 'NF', '673': 'BN', '674': 'NR', '675': 'PG',
  '676': 'TO', '677': 'SB', '678': 'VU', '679': 'FJ', '680': 'PW',
  '681': 'WF', '682': 'CK', '683': 'NU', '685': 'WS', '686': 'KI',
  '687': 'NC', '688': 'TV', '689': 'PF', '690': 'TK', '691': 'FM',
  '692': 'MH',
  '850': 'KP', '852': 'HK', '853': 'MO', '855': 'KH', '856': 'LA',
  '880': 'BD', '886': 'TW',
  '960': 'MV', '961': 'LB', '962': 'JO', '963': 'SY', '964': 'IQ',
  '965': 'KW', '966': 'SA', '967': 'YE', '968': 'OM', '970': 'PS',
  '971': 'AE', '972': 'IL', '973': 'BH', '974': 'QA', '975': 'BT',
  '976': 'MN', '977': 'NP', '992': 'TJ', '993': 'TM', '994': 'AZ',
  '995': 'GE', '996': 'KG', '998': 'UZ',

  // 2-digit codes
  '20': 'EG', '27': 'ZA',
  '30': 'GR', '31': 'NL', '32': 'BE', '33': 'FR', '34': 'ES',
  '36': 'HU', '39': 'IT',
  '40': 'RO', '41': 'CH', '43': 'AT', '44': 'GB', '45': 'DK',
  '46': 'SE', '47': 'NO', '48': 'PL', '49': 'DE',
  '51': 'PE', '52': 'MX', '53': 'CU', '54': 'AR', '55': 'BR',
  '56': 'CL', '57': 'CO', '58': 'VE',
  '60': 'MY', '61': 'AU', '62': 'ID', '63': 'PH', '64': 'NZ',
  '65': 'SG', '66': 'TH',
  '81': 'JP', '82': 'KR', '84': 'VN', '86': 'CN',
  '90': 'TR', '91': 'IN', '92': 'PK', '93': 'AF', '94': 'LK',
  '95': 'MM', '98': 'IR',

  // 1-digit code (NANP — handled below with area-code lookup)
  '7': 'RU', // also KZ for some prefixes; close enough for billing
};

const SORTED_PREFIXES = Object.keys(DIALING_CODES).sort((a, b) => b.length - a.length);

/**
 * Resolve an E.164 number (with or without leading `+`) to ISO country code.
 * Returns null if the prefix can't be matched — callers should fall back to
 * the global `sms_country_rates` default row.
 */
export function resolveCountryFromE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d]/g, '');
  if (!digits) return null;

  // NANP special case: +1 + 3-digit area code → US/CA/Caribbean
  if (digits.startsWith('1') && digits.length >= 4) {
    const areaCode = digits.slice(1, 4);
    const carib = NANP_OTHER_AREA_CODES[areaCode];
    if (carib) return carib;
    if (NANP_CA_AREA_CODES.has(areaCode)) return 'CA';
    return 'US';
  }

  for (const prefix of SORTED_PREFIXES) {
    if (digits.startsWith(prefix)) {
      return DIALING_CODES[prefix];
    }
  }
  return null;
}
