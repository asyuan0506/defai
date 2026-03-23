export async function get_order()
{
  const orderResponse = await (
    await fetch(
      'https://api.jup.ag/ultra/v1/order' +
      '?inputMint=So11111111111111111111111111111111111111112' +
      '&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' +
      '&amount=100' +
      '&taker=9bXbZsnYFx53D27zh1Es59so8sK2L2JYv9L9Dw8yJjE7',
      {
        headers: {
          'x-api-key': '0ba160c2-68c3-4a7b-9a57-d8b54b90b58c',
        },
      }
    )
  ).json();
  console.log(orderResponse);
  return orderResponse;
}
