import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Heart, CalendarDays, MapPin, CheckCircle2, LogOut } from 'lucide-react-native';

export default function DonorHomeScreen({ navigation }) {
    const { user, logout } = useAuth();

    const modules = [
        {
            title: 'Donor Portal',
            route: 'Donors',
            desc: 'Track eligibility, impact, and nearby camps.',
            color: '#10B981',
            icon: Heart
        },
        {
            title: 'Appointments',
            route: 'Appointments',
            desc: 'Review your booking history and statuses.',
            color: '#0EA5E9',
            icon: CalendarDays
        },
        {
            title: 'Camps',
            route: 'Camps',
            desc: 'Find donation events near your district.',
            color: '#F59E0B',
            icon: MapPin
        }
    ];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
            <View style={styles.header}>
                <View style={styles.headerTextWrap}>
                    <Text style={styles.kicker}>Overview</Text>
                    <Text style={styles.title}>Dashboard</Text>
                    <Text style={styles.subtitle}>
                        {user?.name ? `Welcome back, ${user.name}` : 'Welcome back to LifeLine'}
                    </Text>
                </View>

                <View style={styles.headerActions}>
                    <View style={styles.statusBadge}>
                        <CheckCircle2 size={16} color="#10B981" />
                        <Text style={styles.statusText}>Ready to Donate</Text>
                    </View>
                    <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                        <LogOut size={15} color="#DC2626" />
                        <Text style={styles.logoutText}>Log Out</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.grid}>
                {modules.map((module) => {
                    const Icon = module.icon;
                    return (
                        <TouchableOpacity
                            key={module.route}
                            style={styles.card}
                            onPress={() => navigation.navigate(module.route)}
                        >
                            <View style={[styles.iconBox, { backgroundColor: `${module.color}15` }]}>
                                <Icon size={24} color={module.color} />
                            </View>
                            <Text style={styles.cardTitle}>{module.title}</Text>
                            <Text style={styles.cardDesc}>{module.desc}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <View style={styles.quickActionsCard}>
                <Text style={styles.quickActionsTitle}>Quick Actions</Text>
                <Text style={styles.quickActionsSubtitle}>
                    Jump into the most common donor tasks from here.
                </Text>

                <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Donors')}>
                    <Text style={styles.secondaryButtonText}>Open Donor Portal</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('BookAppointment')}>
                    <Text style={styles.secondaryButtonText}>Book Donation</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Camps')}>
                    <Text style={styles.secondaryButtonText}>Browse Camps</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F0F4FF'
    },
    scroll: {
        padding: 20,
        paddingBottom: 40
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 24,
        gap: 16
    },
    headerTextWrap: {
        flex: 1
    },
    kicker: {
        color: '#E11D48',
        fontWeight: 'bold',
        fontSize: 13,
        marginBottom: 4,
        textTransform: 'uppercase'
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 4
    },
    subtitle: {
        color: '#64748B',
        fontSize: 14,
        lineHeight: 20
    },
    headerActions: {
        alignItems: 'flex-end',
        gap: 10
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        gap: 6
    },
    statusText: {
        color: '#064E3B',
        fontWeight: '600',
        fontSize: 12
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FEF2F2',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999
    },
    logoutText: {
        color: '#DC2626',
        fontWeight: '700',
        fontSize: 12
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 24
    },
    card: {
        width: '48%',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 18,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2
    },
    iconBox: {
        width: 42,
        height: 42,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12
    },
    cardTitle: {
        fontWeight: '800',
        color: '#1E293B',
        fontSize: 15,
        marginBottom: 6
    },
    cardDesc: {
        color: '#64748B',
        fontSize: 12,
        lineHeight: 18
    },
    quickActionsCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2
    },
    quickActionsTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 6
    },
    quickActionsSubtitle: {
        color: '#64748B',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 18
    },
    secondaryButton: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingVertical: 13,
        paddingHorizontal: 14,
        marginBottom: 10,
        backgroundColor: '#F8FAFC'
    },
    secondaryButtonText: {
        color: '#334155',
        fontWeight: '700',
        fontSize: 14,
        textAlign: 'center'
    }
});
