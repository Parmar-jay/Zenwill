import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  TextInput,
  Modal,
  ActivityIndicator,
  Switch,
  Alert,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { useRouter, Stack, useFocusEffect } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { journalApi, JournalEntry } from '@/services/journal-api';
import { useDailyMissionStore } from '@/store/daily-mission-store';
import { useHabitStore } from '@/store/habit-store';
import { PageEntrance } from '@/components/ui/smooth-loader';


const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch (error) {
    // Silent catch
  }
};

const getMoodColor = (mood?: string | null) => {
  switch (mood?.toLowerCase()) {
    case 'calm':
      return '#34D399';
    case 'proud':
      return '#FBBF24';
    case 'anxious':
      return '#F97316';
    case 'frustrated':
      return '#EF4444';
    case 'grateful':
      return '#FACC15';
    case 'reflective':
      return '#A855F7';
    default:
      return '#FBBF24';
  }
};

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeFormatted = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `${dateFormatted} • ${timeFormatted}`;
  } catch {
    return dateStr;
  }
};

export default function JournalIndexScreen() {
  const router = useRouter();

  // Pure real database state
  const [myEntries, setMyEntries] = useState<JournalEntry[]>([]);
  const [communityEntries, setCommunityEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmotionFilter, setSelectedEmotionFilter] = useState('All');

  // Modal & Form State
  const [isWriteModalOpen, setIsWriteModalOpen] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newContent, setNewContent] = useState<string>('');
  const [selectedMood, setSelectedMood] = useState<string>('Reflective');
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load real database data
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [userEntriesData, communityData] = await Promise.all([
        journalApi.getEntries().catch((err) => {
          console.warn('getEntries error:', err);
          return [];
        }),
        journalApi.getCommunityRecent(5).catch((err) => {
          console.warn('getCommunityRecent error:', err);
          return [];
        }),
      ]);

      setMyEntries(Array.isArray(userEntriesData) ? userEntriesData : []);
      setCommunityEntries(Array.isArray(communityData) ? communityData : []);
    } catch (error) {
      console.warn('Failed to fetch journal data:', error);
      setMyEntries([]);
      setCommunityEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Save entry handler with fault resistance
  const handleSaveEntry = async () => {
    const trimmedContent = newContent.trim();
    if (!trimmedContent) {
      const msg = 'Please enter your reflection content before saving.';
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('Content Required', msg);
      }
      return;
    }

    const tempId = `temp-journal-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const savedTitle = newTitle.trim();
    const savedMood = selectedMood;
    const savedIsPublic = isPublic;

    const newEntry: JournalEntry = {
      id: tempId,
      user_id: 'user_me',
      author_name: 'Operative',
      title: savedTitle || 'Reflection',
      content: trimmedContent,
      mood_tag: savedMood,
      emotional_tags: [savedMood],
      is_private: !savedIsPublic,
      created_at: nowIso,
      updated_at: nowIso,
    };

    // 1. Optimistically update local entries & complete mission immediately
    setMyEntries((prev) => [newEntry, ...prev]);
    if (savedIsPublic) {
      setCommunityEntries((prev) => [newEntry, ...prev.slice(0, 4)]);
    }
    useDailyMissionStore.getState().completeTask('journal');

    // 2. Reset form & close modal instantly (zero delay)
    setNewTitle('');
    setNewContent('');
    setSelectedMood('Reflective');
    setIsPublic(true);
    setIsWriteModalOpen(false);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);

    // 3. Fire backend API in background
    const payload = {
      title: savedTitle || undefined,
      content: trimmedContent,
      mood_tag: savedMood,
      emotional_tags: [savedMood],
      is_private: !savedIsPublic,
    };

    journalApi.createEntry(payload)
      .then((created) => {
        if (created && created.id) {
          setMyEntries((prev) => prev.map((e) => (e.id === tempId ? created : e)));
          if (isPublic) {
            setCommunityEntries((prev) => prev.map((e) => (e.id === tempId ? created : e)));
          }
          useHabitStore.getState().syncFromDatabase().catch(() => {});
        }
      })
      .catch((err) => console.log('Journal background sync warning:', err));
  };

  // Filter personal entries
  const filteredMyEntries = myEntries.filter((e) => {
    const matchesSearch =
      (e.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.content || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEmotion =
      selectedEmotionFilter === 'All' ||
      (e.mood_tag || '').toLowerCase() === selectedEmotionFilter.toLowerCase();
    return matchesSearch && matchesEmotion;
  });

  return (
    <LinearGradient colors={['#000000', '#000000', '#000000']} style={styles.gradientBg}>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Minimalist Top Header */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => {
              triggerHaptic();
              if (router.canGoBack()) {
                router.back();
              } else {
                router.navigate('/(tabs)/home' as any);
              }
            }}
          >
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center', flex: 1 }}>
            <ThemedText style={styles.topCategoryText}>MINDFUL REFLECTIONS</ThemedText>
            <ThemedText style={styles.topTitleText}>Journal</ThemedText>
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              triggerHaptic();
              setIsWriteModalOpen(true);
            }}
          >
            <Ionicons name="add" size={22} color="#000000" />
          </TouchableOpacity>
        </View>

        <PageEntrance style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Hero Banner */}
          <View style={styles.heroCard}>
            <LinearGradient
              colors={['rgba(245, 158, 11, 0.16)', 'rgba(251, 191, 36, 0.04)']}
              style={styles.heroGradient}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroIconBadge}>
                  <Ionicons name="book-outline" size={20} color="#FBBF24" />
                </View>
                <View style={styles.syncBadge}>
                  <View style={styles.pulseDot} />
                  <ThemedText style={styles.syncBadgeText}>Live Database Sync</ThemedText>
                </View>
              </View>

              <View style={styles.heroTextContainer}>
                <ThemedText style={styles.heroTitle}>Daily Mindful Journal</ThemedText>
                <ThemedText style={styles.heroSubtitle}>
                  Reflect on your day, record personal wins, and read real reflections shared by the community.
                </ThemedText>
              </View>

              <TouchableOpacity
                style={styles.heroCtaBtn}
                activeOpacity={0.85}
                onPress={() => {
                  triggerHaptic();
                  setIsWriteModalOpen(true);
                }}
              >
                <Ionicons name="create-outline" size={16} color="#000000" />
                <ThemedText style={styles.heroCtaText}>Write New Reflection</ThemedText>
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Section 1: Recent Community Journals (Real Database Only) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderTitleRow}>
                <Ionicons name="people-outline" size={16} color="#FBBF24" />
                <ThemedText style={styles.sectionTitle}>Community Reflections</ThemedText>
              </View>
              <ThemedText style={styles.badgeTag}>Recent 5</ThemedText>
            </View>

            {isLoading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color="#FBBF24" />
                <ThemedText style={styles.loadingText}>Fetching database entries...</ThemedText>
              </View>
            ) : communityEntries.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.communityRow}
              >
                {communityEntries.map((item) => {
                  const moodColor = getMoodColor(item.mood_tag);
                  return (
                    <View key={item.id} style={styles.communityTile}>
                      <View style={styles.tileHeader}>
                        <View style={styles.authorRow}>
                          <Ionicons name="person-circle-outline" size={16} color="#CBD5E1" />
                          <ThemedText style={styles.authorText}>
                            {item.author_name || 'Community Member'}
                          </ThemedText>
                        </View>
                        <View style={[styles.moodBadge, { backgroundColor: `${moodColor}20` }]}>
                          <ThemedText style={[styles.moodBadgeText, { color: moodColor }]}>
                            {item.mood_tag || 'Reflective'}
                          </ThemedText>
                        </View>
                      </View>

                      {item.title ? (
                        <ThemedText style={styles.tileTitle} numberOfLines={1}>
                          {item.title}
                        </ThemedText>
                      ) : null}

                      <ThemedText style={styles.tileContent} numberOfLines={3}>
                        "{item.content}"
                      </ThemedText>

                      <ThemedText style={styles.tileDate}>{formatDate(item.created_at)}</ThemedText>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="journal-outline" size={28} color="#64748B" />
                <ThemedText style={styles.emptyTitleText}>No Recent Journals</ThemedText>
                <ThemedText style={styles.emptySubText}>
                  No public community reflections found in the database.
                </ThemedText>
              </View>
            )}
          </View>

          {/* Section 2: Personal Reflections List (Real Database Only) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionTitle}>Your Reflections</ThemedText>
              <TouchableOpacity onPress={loadData} style={styles.refreshBtn}>
                <Ionicons name="refresh-outline" size={15} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Filter & Search Bar */}
            <View style={styles.filterSection}>
              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={16} color="#64748B" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search your reflections..."
                  placeholderTextColor="#64748B"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {['All', 'Calm', 'Proud', 'Anxious', 'Frustrated', 'Grateful', 'Reflective'].map(
                  (emotion) => {
                    const active = selectedEmotionFilter.toLowerCase() === emotion.toLowerCase();
                    return (
                      <TouchableOpacity
                        key={emotion}
                        style={[styles.filterChip, active && styles.filterChipActive]}
                        onPress={() => {
                          triggerHaptic();
                          setSelectedEmotionFilter(emotion);
                        }}
                      >
                        <ThemedText
                          style={[styles.chipText, active && styles.chipTextActive]}
                        >
                          {emotion}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  }
                )}
              </ScrollView>
            </View>

            {/* User Reflections List */}
            {isLoading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color="#FBBF24" />
              </View>
            ) : filteredMyEntries.length > 0 ? (
              <View style={styles.entriesList}>
                {filteredMyEntries.map((item) => {
                  const moodColor = getMoodColor(item.mood_tag);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.entryCard}
                      activeOpacity={0.8}
                      onPress={() => {
                        triggerHaptic();
                        router.push(`/journal/details?id=${item.id}` as any);
                      }}
                    >
                      <View style={styles.entryTop}>
                        <View style={[styles.moodBadge, { backgroundColor: `${moodColor}20` }]}>
                          <ThemedText style={[styles.moodBadgeText, { color: moodColor }]}>
                            {item.mood_tag || 'Reflective'}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.entryDate}>{formatDate(item.created_at)}</ThemedText>
                      </View>

                      {item.title ? <ThemedText style={styles.entryTitle}>{item.title}</ThemedText> : null}
                      
                      <ThemedText style={styles.entryBody} numberOfLines={3}>
                        {item.content}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="journal-outline" size={28} color="#64748B" />
                <ThemedText style={styles.emptyTitleText}>No Recent Journals</ThemedText>
                <ThemedText style={styles.emptySubText}>
                  {searchQuery
                    ? 'No reflections match your search filter.'
                    : 'Tap the "+" button above to write your first reflection.'}
                </ThemedText>
              </View>
            )}
          </View>
        </ScrollView>
      </PageEntrance>
      </SafeAreaView>

      {/* Write New Reflection Modal (Fixed Backdrop Structure so Modal never disappears when typing) */}
      <Modal
        visible={isWriteModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsWriteModalOpen(false)}
      >
        <View style={styles.modalContainer}>
          {/* Backdrop Touch Overlay (Behind Sheet) */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsWriteModalOpen(false)}
          />

          {/* Modal Content Sheet (Sibling, completely independent of backdrop touch) */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
            style={styles.modalSheet}
          >
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="create-outline" size={20} color="#FBBF24" />
                <ThemedText style={styles.modalTitleText}>New Reflection</ThemedText>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setIsWriteModalOpen(false)}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={styles.modalBody}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Emotion Selector */}
              <View style={styles.fieldGroup}>
                <ThemedText style={styles.fieldLabel}>Emotion / Mood</ThemedText>
                <View style={styles.moodGrid}>
                  {['Calm', 'Proud', 'Anxious', 'Frustrated', 'Grateful', 'Reflective'].map((mood) => {
                    const active = selectedMood === mood;
                    const mColor = getMoodColor(mood);
                    return (
                      <TouchableOpacity
                        key={mood}
                        style={[
                          styles.moodChip,
                          active && { backgroundColor: mColor, borderColor: mColor },
                        ]}
                        onPress={() => {
                          triggerHaptic();
                          setSelectedMood(mood);
                        }}
                      >
                        <ThemedText style={[styles.moodChipText, active && styles.moodChipTextActive]}>
                          {mood}
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Title Field */}
              <View style={styles.fieldGroup}>
                <ThemedText style={styles.fieldLabel}>Title (Optional)</ThemedText>
                <TextInput
                  style={styles.inputField}
                  placeholder="Title or focus theme..."
                  placeholderTextColor="#64748B"
                  value={newTitle}
                  onChangeText={setNewTitle}
                />
              </View>

              {/* Content Field */}
              <View style={styles.fieldGroup}>
                <ThemedText style={styles.fieldLabel}>Your Thoughts</ThemedText>
                <TextInput
                  style={[styles.inputField, styles.textArea]}
                  placeholder="Write freely about your day, feelings, triggers, or gratitude..."
                  placeholderTextColor="#64748B"
                  multiline
                  numberOfLines={6}
                  value={newContent}
                  onChangeText={setNewContent}
                />
              </View>

              {/* Share Switch */}
              <View style={styles.shareRow}>
                <View style={{ flex: 1, gap: 2 }}>
                  <ThemedText style={styles.shareTitle}>Share with Community</ThemedText>
                  <ThemedText style={styles.shareSub}>
                    Allow other members to read your entry in the community feed.
                  </ThemedText>
                </View>
                <Switch
                  value={isPublic}
                  onValueChange={(val) => {
                    triggerHaptic();
                    setIsPublic(val);
                  }}
                  trackColor={{ false: '#27272A', true: '#F59E0B' }}
                  thumbColor="#ffffff"
                />
              </View>

              {/* Save Button */}
              <TouchableOpacity
                style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
                disabled={isSubmitting}
                onPress={handleSaveEntry}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={18} color="#000000" />
                    <ThemedText style={styles.submitBtnText}>Save Reflection</ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBg: { flex: 1 },
  safeArea: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  iconBtn: {
    backgroundColor: 'transparent',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FBBF24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topCategoryText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FBBF24',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  topTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 100,
    gap: 20,
  },
  heroCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: 'rgba(15, 15, 18, 0.8)',
  },
  heroGradient: {
    padding: 16,
    gap: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FBBF24',
  },
  syncBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FBBF24',
  },
  heroTextContainer: { gap: 4 },
  heroTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff', letterSpacing: -0.3 },
  heroSubtitle: { fontSize: 12, color: '#94A3B8', lineHeight: 17 },
  heroCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FBBF24',
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 2,
  },
  heroCtaText: { color: '#000000', fontSize: 13, fontWeight: '800' },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  badgeTag: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FBBF24',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  refreshBtn: {
    padding: 4,
  },
  communityRow: {
    gap: 12,
    paddingRight: 16,
  },
  communityTile: {
    width: 260,
    backgroundColor: 'rgba(15, 15, 18, 0.85)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    gap: 8,
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  authorText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  moodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  moodBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  tileTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FBBF24',
  },
  tileContent: {
    fontSize: 12,
    color: '#CBD5E1',
    lineHeight: 17,
    fontStyle: 'italic',
  },

  tileDate: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'right',
  },
  filterSection: {
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
  },
  chipRow: {
    gap: 6,
  },
  filterChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    backgroundColor: '#FBBF24',
    borderColor: '#FBBF24',
  },
  chipText: {
    fontSize: 11.5,
    color: '#94A3B8',
  },
  chipTextActive: {
    color: '#000000',
    fontWeight: '700',
  },
  entriesList: {
    gap: 12,
  },
  entryCard: {
    backgroundColor: 'rgba(15, 15, 18, 0.85)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 14,
    gap: 8,
  },
  entryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryDate: {
    fontSize: 11,
    color: '#64748B',
  },
  entryTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#ffffff',
  },
  entryBody: {
    fontSize: 12.5,
    color: '#CBD5E1',
    lineHeight: 18,
  },

  loadingCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyContainer: {
    backgroundColor: 'rgba(15, 15, 18, 0.6)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  emptySubText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0A0A0C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    padding: 18,
    maxHeight: '90%',
    gap: 14,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    gap: 14,
    paddingBottom: 24,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#CBD5E1',
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moodChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  moodChipText: {
    fontSize: 11.5,
    color: '#94A3B8',
  },
  moodChipTextActive: {
    color: '#000000',
    fontWeight: '800',
  },
  inputField: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  shareTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  shareSub: {
    fontSize: 11,
    color: '#94A3B8',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FBBF24',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});
