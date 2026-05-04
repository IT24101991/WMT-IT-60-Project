import React, { useState, useEffect } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, TouchableOpacity, 
    ActivityIndicator
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { AlertCircle, AlertTriangle, Droplet } from 'lucide-react-native';

export default function DonorDashboardScreen({ navigation, portalRoute = 'Donors' }) {
    const { user, logout, isAdmin } = useAuth();
    const donorId = user?.id || user?.userId;
    const [donorData, setDonorData] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [nextNearbyCamp, setNextNearbyCamp] = useState(null);
    const [eligibility, setEligibility] = useState({ eligible: true });
    const [loading, setLoading] = useState(true);

    const formatEligibilityMessage = (details = {}) => {
        if (details?.type === 'SAFETY') {
            return details.reason || 'Not eligible because latest test result is positive.';
        }
        if (details?.type === 'RECENT_DONATION') {
            const waitText = typeof details.daysRemaining === 'number'
                ? ` Wait ${details.daysRemaining} more day(s).`
                : '';
            return `${details.reason || 'You donated recently and must wait at least 60 days.'}${waitText}`;
        }
        return details.reason || 'You are not eligible to donate right now.';
    };

    useEffect(() => {
        if (!donorId) return;

        const fetchData = async () => {
            try {
                const [donorRes, elRes, apptRes, campsRes] = await Promise.allSettled([
                    api.get(`/api/donors/user/${donorId}`),
                    api.get(`/api/donors/${donorId}/eligibility`),
                    api.get(`/api/appointments/donor/${donorId}`),
                    api.get('/api/camps')
                ]);

                if (donorRes.status === 'fulfilled') setDonorData(donorRes.value.data);
                if (elRes.status === 'fulfilled') setEligibility(elRes.value.data);
                if (apptRes.status === 'fulfilled') setAppointments(apptRes.value.data || []);

                if (campsRes.status === 'fulfilled') {
                    const allCamps = campsRes.value.data || [];
                    const district = (user?.district || '').toLowerCase();
                    const province = (user?.province || '').toLowerCase();
                    
                    const matched = allCamps.filter(c => {
                        const cDist = String(c.district || '').toLowerCase();
                        const cProv = String(c.province || '').toLowerCase();
                        return (district && cDist === district) || (province && cProv === province);
                    });
                    
                    const pool = matched.length > 0 ? matched : allCamps;
                    const upcoming = pool
                        .filter(c => (c.campStatus || '').toUpperCase() !== 'ENDED')
                        .sort((a, b) => new Date(`${a.date}T${a.startTime || '00:00'}`) - new Date(`${b.date}T${b.startTime || '00:00'}`));
                    
                    setNextNearbyCamp(upcoming[0] || null);
                }
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [donorId, user]);

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color="#E11D48" />
            </View>
        );
    }

    const completedCount = appointments.filter(a => (a.status || '').toLowerCase() === 'completed').length;
    const totalVolume = completedCount * 0.5;

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
            <View style={styles.header}>
                {isAdmin && portalRoute === 'Donors' ? (
                    <TouchableOpacity onPress={() => navigation.navigate('AdminDashboard')} style={styles.backButton}>
                        <Text style={styles.backButtonText}>Back to Dashboard</Text>
                    </TouchableOpacity>
                ) : null}
                <Text style={styles.pageKicker}>Donor</Text>
                <Text style={styles.pageTitle}>Donor Portal</Text>
                <Text style={styles.pageSubtitle}>Track your impact, eligibility, and upcoming opportunities.</Text>
            </View>

            {donorData?.safetyStatus === 'POSITIVE' && (
                <View style={styles.alertBox}>
                    <View style={styles.alertTitleRow}>
                        <AlertTriangle color="#991B1B" size={20} />
                        <Text style={styles.alertTitle}>Safety Status: POSITIVE</Text>
                    </View>
                    <Text style={styles.alertText}><Text style={{fontWeight: 'bold'}}>Reason:</Text> {donorData.positiveReason}</Text>
                    <Text style={styles.alertSubText}>You are permanently blocked from further donations. Please consult a doctor.</Text>
                </View>
            )}

            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Droplet color="#BE123C" size={20} />
                    <Text style={styles.cardTitle}>Eligibility Check</Text>
                </View>
                
                <View style={styles.eligibilityIconBox}>
                    <Text style={styles.eligibilityIconText}>i</Text>
                </View>

                <Text style={styles.eligibilityHeading}>Eligibility Checked at Booking</Text>
                <Text style={styles.eligibilityDesc}>We verify your eligibility each time you book an appointment.</Text>

                <TouchableOpacity 
                    style={[styles.button, (!eligibility.eligible || donorData?.safetyStatus === 'POSITIVE') ? styles.buttonDisabled : null]}
                    disabled={!eligibility.eligible || donorData?.safetyStatus === 'POSITIVE'}
                    onPress={() => navigation.navigate('BookAppointment')}
                >
                    <Text style={styles.buttonText}>
                        {donorData?.safetyStatus === 'POSITIVE' ? 'Permanently Blocked' : 
                          (!eligibility.eligible ? 'Booking Restricted' : 'Book Appointment Now')}
                    </Text>
                </TouchableOpacity>

                {!eligibility.eligible && eligibility.reason && (
                    <View style={styles.inlineWarningRow}>
                        <AlertCircle color="#991B1B" size={14} />
                        <Text style={styles.inlineWarningText}>
                            {formatEligibilityMessage(eligibility)}
                            {eligibility.nextEligibleDate ? `\n(Available from ${new Date(eligibility.nextEligibleDate).toLocaleDateString()})` : ''}
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Your Impact</Text>
                <View style={styles.impactGrid}>
                    <View style={styles.impactBox}>
                        <Text style={styles.impactValue}>{completedCount}</Text>
                        <Text style={styles.impactLabel}>Lives Saved</Text>
                    </View>
                    <View style={styles.impactBox}>
                        <Text style={[styles.impactValue, {color: '#0D9488'}]}>{totalVolume.toFixed(1)}L</Text>
                        <Text style={styles.impactLabel}>Volume Donated</Text>
                    </View>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Next Camp Nearby</Text>
                {nextNearbyCamp ? (
                    <View style={styles.campInfo}>
                        <Text style={styles.campName}>{nextNearbyCamp.name}</Text>
                        <Text style={styles.campDate}>{new Date(nextNearbyCamp.date).toLocaleDateString()} • {nextNearbyCamp.startTime || 'TBD'}</Text>
                        <Text style={styles.campLoc}>{nextNearbyCamp.district}, {nextNearbyCamp.province}</Text>
                    </View>
                ) : (
                    <Text style={styles.campEmpty}>Add your province and district in profile to personalize nearby camps.</Text>
                )}
                <TouchableOpacity style={styles.outlineButton} onPress={() => navigation.navigate('Camps')}>
                    <Text style={styles.outlineButtonText}>View All Camps</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                <Text style={styles.logoutButtonText}>Log Out</Text>
            </TouchableOpacity>

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F0F4FF',
    },
    header: {
        marginTop: 40,
        marginBottom: 24,
    },
    backButton: {
        alignSelf: 'flex-start',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    backButtonText: {
        color: '#475569',
        fontWeight: '700',
        fontSize: 13,
    },
    pageKicker: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#E11D48',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8,
    },
    pageTitle: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 8,
    },
    pageSubtitle: {
        fontSize: 16,
        color: '#64748B',
    },
    alertBox: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        padding: 16,
        borderRadius: 12,
        marginBottom: 20,
    },
    alertTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    alertTitle: {
        color: '#991B1B',
        fontWeight: 'bold',
        fontSize: 16,
    },
    alertText: {
        color: '#991B1B',
        marginBottom: 4,
    },
    alertSubText: {
        color: '#991B1B',
        fontSize: 12,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 24,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1E293B',
        marginBottom: 16,
    },
    eligibilityIconBox: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 16,
    },
    eligibilityIconText: {
        fontSize: 40,
        color: '#1D4ED8',
        fontStyle: 'italic',
        fontWeight: 'bold',
    },
    eligibilityHeading: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1D4ED8',
        textAlign: 'center',
        marginBottom: 8,
    },
    eligibilityDesc: {
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 20,
    },
    button: {
        backgroundColor: '#1D4ED8',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
    inlineWarningRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        gap: 6,
    },
    inlineWarningText: {
        color: '#991B1B',
        fontSize: 12,
        fontWeight: '500',
        textAlign: 'center',
    },
    impactGrid: {
        flexDirection: 'row',
        gap: 16,
    },
    impactBox: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    impactValue: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#E11D48',
    },
    impactLabel: {
        fontSize: 14,
        color: '#64748B',
    },
    campInfo: {
        marginBottom: 16,
    },
    campName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1E293B',
    },
    campDate: {
        fontSize: 14,
        color: '#64748B',
        marginTop: 4,
    },
    campLoc: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    campEmpty: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 16,
    },
    outlineButton: {
        borderWidth: 1,
        borderColor: '#E11D48',
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    outlineButtonText: {
        color: '#E11D48',
        fontWeight: 'bold',
        fontSize: 14,
    },
    logoutButton: {
        marginTop: 10,
        marginBottom: 40,
        padding: 16,
        alignItems: 'center',
    },
    logoutButtonText: {
        color: '#DC2626',
        fontWeight: 'bold',
        fontSize: 16,
    }
});
