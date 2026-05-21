import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // 强制使用非Secure cookie（SOLO代理环境是HTTP，不是HTTPS）
  useSecureCookies: false,
  // 强制使用非前缀cookie名（生产模式下默认用__Secure-前缀，HTTP下不生效）
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
    callbackUrl: {
      name: 'next-auth.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false,
      },
    },
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        const user = await prisma.userAccount.findUnique({
          where: { email: credentials.email as string },
          include: { member: { include: { team: true } } },
        });

        if (!user) return null;

        // Phase 1: 简单密码验证（后续对接SSO/飞书后替换）
        if (credentials.password !== 'initial_password') return null;

        return {
          id: user.id,
          email: user.email,
          name: user.email,
          role: user.role,
          memberId: user.memberId,
          teamId: user.member?.teamId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as unknown as Record<string, unknown>).role;
        token.memberId = (user as unknown as Record<string, unknown>).memberId;
        token.teamId = (user as unknown as Record<string, unknown>).teamId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as Record<string, unknown>).role = token.role;
        (session.user as unknown as Record<string, unknown>).memberId = token.memberId;
        (session.user as unknown as Record<string, unknown>).teamId = token.teamId;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60,
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
});
