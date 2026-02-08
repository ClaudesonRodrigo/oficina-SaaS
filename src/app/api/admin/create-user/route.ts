import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    // 1. Segurança: Verificar Token do Usuário logado que está tentando criar outro
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token não fornecido' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    // UID do Super Admin (Sabio dos 6 Caninos)
    const superAdminUID = "kJ4iOKdHmbgr4mWms34rp24w9413";

    // Verifica se é admin via Role ou se é o seu UID de Super Admin
    const isAuthorized = decodedToken.role === 'admin' || decodedToken.uid === superAdminUID;

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Apenas administradores podem criar usuários.' },
        { status: 403 }
      );
    }

    // 2. Extrair e validar dados do corpo da requisição
    const { nome, email, password, role } = await request.json();

    if (!nome || !email || !password || !role) {
      return NextResponse.json(
        { error: 'Dados incompletos. Certifique-se de enviar nome, email, senha e role.' },
        { status: 400 }
      );
    }

    // 3. Criar o usuário no Firebase Authentication
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName: nome,
    });

    // 4. Definir Custom Claims (Role) no Auth para as Security Rules funcionarem
    await adminAuth.setCustomUserClaims(userRecord.uid, { role });

    // 5. Salvar os dados complementares no Firestore
    // Usamos o UID gerado pelo Auth como ID do documento para garantir o vínculo
    await adminDb.collection('usuarios').doc(userRecord.uid).set({
      uid: userRecord.uid,
      nome,
      email,
      role,
      ownerId: decodedToken.uid, // Quem criou este usuário (útil para auditoria no SaaS)
      createdAt: new Date().toISOString(),
      status: 'ativo'
    });

    return NextResponse.json({
      message: 'Usuário criado com sucesso!',
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        nome: nome,
        role: role
      }
    }, { status: 201 });

  } catch (error: any) {
    console.error('Erro ao criar usuário:', error);

    // Tratamento de erros específicos do Firebase (Essencial para o seu Debug)
    if (error.code === 'auth/email-already-exists') {
      return NextResponse.json({ error: 'Este e-mail já está em uso.' }, { status: 400 });
    }
    
    if (error.code === 'auth/invalid-password') {
      return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 });
    }

    if (error.code === 'auth/operation-not-allowed') {
      return NextResponse.json({ error: 'O provedor de senha/email não está habilitado no Console do Firebase.' }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Erro interno ao processar a criação do usuário.', detalhe: error.message },
      { status: 500 }
    );
  }
}