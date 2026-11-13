const FLAG_CODE = { PKR:'pk',USD:'us',GBP:'gb',EUR:'eu',CNY:'cn',AED:'ae',SAR:'sa',INR:'in',JPY:'jp',CAD:'ca',AUD:'au',CHF:'ch',SGD:'sg',MYR:'my',TRY:'tr',KWD:'kw',QAR:'qa',BHD:'bh',OMR:'om',ZAR:'za',NZD:'nz',HKD:'hk' };
export function CurrencyFlag({ code, size = 18 }) {
  const file = FLAG_CODE[code] || 'eu';
  return <img className="currency-flag" src={`/images/flags/${file}.svg`} width={size} height={Math.round(size*2/3)} alt="" aria-hidden="true" loading="lazy" />;
}
