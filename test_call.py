from twilio.rest import Client

# Using the exact credentials that just passed the test
account_sid = 'AC2d8eb1e3c688caf7396fc5f1c89fb501'
auth_token = '73323c481e950b70efb7fe3d94ddde0b'

client = Client(account_sid, auth_token)

call = client.calls.create(
    to='+919760849372',
    from_='+16063570297',
    url='https://grope-tanned-overcook.ngrok-free.dev/webhook/doctor-bot'
)

print("📞 Call placed successfully! SID:", call.sid)