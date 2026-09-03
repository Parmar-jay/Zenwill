import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  View,
  Platform,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { journalApi, JournalEntry } from '@/services/journal-api';

const triggerHaptic = (style = Haptics.ImpactFeedbackStyle.Light) => {
  try {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(style);
    }
  } catch (error) {
    // Silent catch
  }
};

export default function JournalDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const entryId = params.id;

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState(false);
  const [entryTitle, setEntryTitle] = useState('');
  const [entryContent, setEntryContent] = useState('');

  useEffect(() => {
    if (entryId) {
      loadEntry(entryId);
    } else {
      setIsLoading(false);
    }
  }, [entryId]);

  const loadEntry = async (id: string) => {
    try {
      setIsLoading(true);
      const data = await journalApi.getEntry(id);
      setEntry(data);
      setEntryTitle(data.title || '');
      setEntryContent(data.content || '');
    } catch (err) {
      console.warn('Could not fetch entry from API:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveUpdate = async () => {
    if (!entryId) return;
    try {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      const updated = await journalApi.updateEntry(entryId, {
        title: entryTitle.trim() || undefined,
        content: entryContent.trim(),
      });
      setEntry(updated);
      setIsEditing(false);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (error) {
      console.error('Error updating entry:', error);
    }
  };

  const handleSaveAndReturn = async () => {
    try {
      setIsSaving(true);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      if (entryId && (isEditing || entryTitle.trim() !== (entry?.title || '') || entryContent.trim() !== (entry?.content || ''))) {
        const updated = await journalApi.updateEntry(entryId, {
          title: entryTitle.trim() || undefined,
          content: entryContent.trim(),
        });
        setEntry(updated);
      }
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/journal' as any);
      }
    } catch (error) {
      console.error('Error saving and returning:', error);
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/journal' as any);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entryId) return;
    const performDelete = async () => {
      try {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
        await journalApi.deleteEntry(entryId);
        router.back();
      } catch (error) {
        console.error('Error deleting entry:', error);
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to delete this reflection?')) {
        performDelete();
      }
    } else {
      Alert.alert('Delete Entry', 'Are you sure you want to delete this reflection?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete },
      ]);
    }
  };

  return (
    <LinearGradient
      colors={['#000000', '#000000', '#000000']}
      style={styles.gradientBg}
    >
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => { triggerHaptic(); router.back(); }}
          >
            <Ionicons name="chevron-back" size={24} color="#00E5FF" />
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <ThemedText style={styles.categoryBadge}>MINDFUL REFLECTION</ThemedText>
            <ThemedText style={styles.headerTitle}>Entry Details</ThemedText>
          </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            {entryId && (
              <TouchableOpacity 
                style={styles.deleteBtn}
                onPress={handleDelete}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              style={styles.editBtn}
              onPress={() => {
                triggerHaptic();
                if (isEditing) {
                  handleSaveUpdate();
                } else {
                  setIsEditing(true);
                }
              }}
            >
              <Ionicons name={isEditing ? "checkmark" : "create-outline"} size={18} color="#000000" />
            </TouchableOpacity>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#FBBF24" />
            <ThemedText style={styles.loadingText}>Loading reflection...</ThemedText>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Entry Meta Card */}
            <View style={styles.metaCard}>
              <View style={styles.metaTop}>
                <View style={styles.emotionTag}>
                  <Ionicons name="sparkles" size={14} color="#FBBF24" />
                  <ThemedText style={styles.emotionTagText}>
                    {entry?.mood_tag || 'Reflective'}
                  </ThemedText>
                </View>
                <ThemedText style={styles.dateText}>
                  {entry?.created_at ? new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Today'}
                </ThemedText>
              </View>

              {entry?.author_name && (
                <ThemedText style={styles.authorText}>By {entry.author_name}</ThemedText>
              )}

              {isEditing ? (
                <TextInput
                  style={styles.editTitleInput}
                  value={entryTitle}
                  onChangeText={setEntryTitle}
                  placeholder="Entry title..."
                  placeholderTextColor="#64748B"
                />
              ) : (
                <ThemedText style={styles.entryTitle}>{entryTitle || 'Untitled Reflection'}</ThemedText>
              )}
            </View>

            {/* Main Body */}
            <View style={styles.bodyCard}>
              {isEditing ? (
                <TextInput
                  style={styles.editBodyInput}
                  value={entryContent}
                  onChangeText={setEntryContent}
                  multiline
                  placeholder="Reflection content..."
                  placeholderTextColor="#64748B"
                />
              ) : (
                <ThemedText style={styles.bodyText}>{entryContent}</ThemedText>
              )}
            </View>


            {/* Bottom Save & Return Action */}
            <TouchableOpacity 
              style={styles.saveReturnBtn}
              onPress={handleSaveAndReturn}
              disabled={isSaving}
              activeOpacity={0.85}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#000000" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color="#000000" />
                  <ThemedText style={styles.saveReturnText}>
                    {isEditing ? 'Save & Return to Journal' : 'Done & Return to Journal'}
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>

          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientBg: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  backBtn: {
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  categoryBadge: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FBBF24',
    letterSpacing: 1.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FBBF24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 100,
  },
  metaCard: {
    backgroundColor: 'rgba(15, 15, 18, 0.85)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    gap: 8,
  },
  metaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emotionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  emotionTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FBBF24',
  },
  dateText: {
    fontSize: 11,
    color: '#64748B',
  },
  authorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  entryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  editTitleInput: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  bodyCard: {
    backgroundColor: 'rgba(15, 15, 18, 0.85)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
  },
  bodyText: {
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 22,
  },
  editBodyInput: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 22,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  saveReturnBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FBBF24',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#FBBF24',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveReturnText: {
    color: '#000000',
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
