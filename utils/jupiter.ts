"use server";

export async function get_order() {
  const orderResponse = await (
    await fetch(
      'https://api.jup.ag/ultra/v1/order' +
      '?inputMint=So11111111111111111111111111111111111111112' +
      '&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' +
      '&amount=100' +
      '&taker=' + process.env.WALLET_ADDRESS,
      {
        headers: {
          'x-api-key': process.env.JUPITER || '',
        },
      }
    )
  ).json();
  console.log(orderResponse);
  return orderResponse;
}
