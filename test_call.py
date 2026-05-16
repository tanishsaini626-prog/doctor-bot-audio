from twilio.rest import Client

account_sid = 'YOUR_TWILIO_ACCOUNT_SID'
auth_token = 'YOUR_TWILIO_AUTH_TOKEN'
client = Client(account_sid, auth_token)

call = client.calls.create(
    to='+919760849372',
    from_='+16063570297',
    url='https://grope-tanned-overcook.ngrok-free.dev/webhook/doctor-bot'
)

print(f'Call SID: {call.sid}')
print('Twilio is calling your phone!')