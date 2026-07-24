from twilio.rest import Client

# Using the exact credentials that just passed the test
account_sid = 'YOUR_TWILIO_ACCOUNT_SID'
auth_token = 'YOUR_TWILIO_AUTH_TOKEN'

client = Client(account_sid, auth_token)

call = client.calls.create(
    to='+919760849372',
    from_='+16063570297',
    url='https://grope-tanned-overcook.ngrok-free.dev/webhook/doctor-bot'
)

print("📞 Call placed successfully! SID:", call.sid)