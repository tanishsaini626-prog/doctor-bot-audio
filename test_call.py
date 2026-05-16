from twilio.rest import Client

account_sid = 'AC2d8eb1e3c688caf7396fc5f1c89fb501'
auth_token = 'ebb37dac87acba61988b41bc64d4d35e'
client = Client(account_sid, auth_token)

call = client.calls.create(
    to='+919760849372',
    from_='+16063570297',
    url='https://grope-tanned-overcook.ngrok-free.dev/webhook/doctor-bot'
)

print(f'Call SID: {call.sid}')
print('Twilio is calling your phone!')