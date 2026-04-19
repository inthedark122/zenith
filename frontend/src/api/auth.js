import client from './client'

export const authApi = {
  login: (email, password) => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    return client.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).then((r) => r.data)
  },

  register: (payload) =>
    client.post('/auth/register', payload).then((r) => r.data),
}
