import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
// Adjust the import path to match where your mock-data is located
import { MOCK_USERS } from '@/data/mock-data';

// Use the Service Role Key to bypass Row Level Security during seeding
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
    try {
        const results = [];

        for (const mockUser of MOCK_USERS) {
            // 1. Check if user already exists to avoid duplicates
            const { data: existingUser } = await supabase
                .from('User')
                .select('email')
                .eq('email', mockUser.email)
                .single();

            if (existingUser) {
                results.push({ email: mockUser.email, status: 'skipped (already exists)' });
                continue;
            }

            // 2. Hash the password
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(mockUser.password, salt);

            // 3. Insert into Supabase
            const { error } = await supabase
                .from('User')
                .insert([
                    {
                        email: mockUser.email,
                        name: mockUser.name,
                        role: mockUser.role,
                        assignedDistrict: mockUser.assignedDistrict === 'ALL' ? null : mockUser.assignedDistrict,
                        password_hash: hashedPassword,
                    }
                ]);

            if (error) {
                results.push({ email: mockUser.email, status: 'error', error: error.message });
            } else {
                results.push({ email: mockUser.email, status: 'success' });
            }
        }

        return NextResponse.json({ success: true, results });

    } catch (error) {
        return NextResponse.json(
            { success: false, error: 'Server error during seeding' },
            { status: 500 }
        );
    }
}